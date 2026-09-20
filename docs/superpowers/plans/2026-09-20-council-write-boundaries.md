# 협의회 쓰기 API 4개 권한·상태 경계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 평가위원 편성·협의회 신청·결재 상신·사전 Q&A 질문 API가 서버에서 허용 주체와 상태를 검사하도록 `CouncilAccessGuard`를 확장하고 4개 서비스에 적용한다.

**Architecture:** COUNCIL-001·002가 만든 `CouncilAccessGuard`에 판정 메서드 4개를 추가하고, 각 서비스 메서드 진입부에서 협의회 원장을 얻은 직후 호출한다. 인증 주체는 가드의 기존 `currentUser()`가 `SecurityContextHolder`에서 읽으므로 서비스 시그니처·컨트롤러·DTO·프론트는 바꾸지 않는다. 검증은 기존 `CouncilAccessBoundaryTest`(Mockito, 실제 서비스·가드 조립)에 케이스를 추가한다.

**Tech Stack:** Spring Boot 4, Spring Security(`CustomUserDetails`), Spring Data JPA, JUnit 5 + Mockito + AssertJ, Spotless.

**Spec:** `docs/superpowers/specs/2026-09-20-council-write-boundaries-design.md`

## Global Constraints

- 수정 범위는 `it_backend/src/main/java/com/kdb/it/domain/council/**`와 `it_backend/src/test/java/com/kdb/it/domain/council/**`뿐이다. 그 밖의 파일을 고쳐야 하면 멈추고 사용자 확인을 받는다.
- 요청·응답 DTO, DB 스키마, 컨트롤러, 프론트 화면은 바꾸지 않는다.
- 거부 응답: 권한 없음 `AccessDeniedException`(403), 상태 위반 `ResponseStatusException(HttpStatus.CONFLICT)`(409). 결재 상신의 기존 `02` 검사(`IllegalStateException`, 400)는 그대로 둔다.
- 신규 주석은 한글로 쓰고 자명한 대입에는 주석을 달지 않는다.
- 커밋은 `git add <경로>`로 파일을 명시하고 `git add -A`·`git commit -a`를 쓰지 않는다. 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`를 붙인다.
- 백엔드 작업 디렉터리는 `C:\it\it_backend`이다. Gradle 명령은 그 디렉터리에서 실행한다.

---

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| Modify `src/main/java/com/kdb/it/domain/council/service/CouncilAccessGuard.java` | 판정 메서드 4개 추가, 사업 키 기준 주관부서 판정 헬퍼 추출, `ProjectItemRepository` 의존 추가 |
| Modify `src/main/java/com/kdb/it/domain/council/service/CommitteeService.java` | `saveCommittee`에 관리 권한·상태(04·05) 검사 |
| Modify `src/main/java/com/kdb/it/domain/council/service/CouncilApprovalService.java` | `requestApproval`에 주관부서·관리 권한 검사 |
| Modify `src/main/java/com/kdb/it/domain/council/service/QnaService.java` | `createQna`에 배정위원·관리 권한 검사 |
| Modify `src/main/java/com/kdb/it/domain/council/service/CouncilService.java` | `createCouncil`에 심의유형·주관부서·정보보호 항목 검사 |
| Modify `src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java` | 가드 생성자 인자 추가, 서비스 3개 조립, 신규 경계 케이스 |
| Modify `src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java` | `@Mock CouncilAccessGuard` 추가, `saveCommittee` 테스트에 원장 스텁 |
| Modify `src/test/java/com/kdb/it/domain/council/service/CouncilApprovalServiceTest.java` | `@Mock CouncilAccessGuard` 추가 |
| Modify `src/test/java/com/kdb/it/domain/council/service/QnaServiceTest.java` | `@Mock CouncilAccessGuard` 추가 |
| Modify `C:\it\TASK_COUNCIL.md`, `C:\it\TASK_COUNCIL_DONE.md`, `C:\it\docs\superpowers\specs\` | 완료 기록과 설계 문서 이동 |

---

### Task 1: `CouncilAccessGuard` 판정 메서드 4개

**Files:**
- Modify: `src/main/java/com/kdb/it/domain/council/service/CouncilAccessGuard.java`
- Test: `src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java`

**Interfaces:**
- Consumes: 기존 `canManage(Basctm, CustomUserDetails)`, `isOwningDepartment(Basctm, CustomUserDetails)`, `currentUser()`, `ProjectItemRepository.existsByAbusMngNoAndSectSysUtzYnAndDelYn(String abusMngNo, String sectSysUtzYn, String delYn)`.
- Produces (Task 2~5가 호출):
  - `public void verifyManageable(Basctm council)`
  - `public void verifyOwningOrManageable(Basctm council)`
  - `public void verifyCommitteeOrManageable(Basctm council)`
  - `public void verifyCreatable(String dbrTc, String abusMngNo, Integer sno)`
  - 생성자는 `(CouncilRepository, ProjectRepository, CommitteeRepository, ProjectItemRepository)` 순서가 된다.

- [ ] **Step 1: 경계 테스트에 가드 의존과 직접 호출용 필드를 추가한다**

`CouncilAccessBoundaryTest.java`의 `@Mock EntityManager entityManager;` 아래에 추가:

```java
    @Mock ProjectItemRepository projectItemRepository;
    private CouncilAccessGuard guard;
```

import 추가:

```java
import com.kdb.it.domain.budget.project.repository.ProjectItemRepository;
import static org.assertj.core.api.Assertions.assertThatCode;
```

`setUp()`에서 기존 가드 생성 부분을 다음으로 교체:

```java
        guard =
                new CouncilAccessGuard(
                        councilRepository, projectRepository, committeeRepository, projectItemRepository);
        ReflectionTestUtils.setField(councilService, "councilAccessGuard", guard);
```

로그인 헬퍼가 사용자를 돌려주도록 바꾼다(Task 3·5에서 서비스 인자로 쓴다):

```java
    private CustomUserDetails loginAs(String role) {
        var user = new CustomUserDetails("USER-1", List.of(role), "OTHER");
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        return user;
    }

    private CustomUserDetails login(String department) {
        var user = new CustomUserDetails("USER-1", List.of("ITPZZ001"), department);
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        return user;
    }
```

- [ ] **Step 2: 가드 판정 실패 테스트를 추가한다**

클래스 끝(헬퍼 앞)에 추가:

```java
    @Test
    void manageableRejectsOwningDepartmentAndCommittee() {
        login("OWNER");
        assertThatThrownBy(() -> guard.verifyManageable(council))
                .isInstanceOf(AccessDeniedException.class);
        when(committeeRepository.findByItPtlAsctIdAndEnoAndDelYn(ID, "USER-1", "N"))
                .thenReturn(Optional.of(mock(Bcmmtm.class)));
        assertThatThrownBy(() -> guard.verifyManageable(council))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void manageableAllowsAdminAndInfoSecOnlyForInfoSecType() {
        loginAs("ITPAD001");
        assertThatCode(() -> guard.verifyManageable(council)).doesNotThrowAnyException();
        loginAs("ITPAD002");
        assertThatThrownBy(() -> guard.verifyManageable(council))
                .isInstanceOf(AccessDeniedException.class);
        ReflectionTestUtils.setField(council, "itPtlAsctDbrTc", "04");
        assertThatCode(() -> guard.verifyManageable(council)).doesNotThrowAnyException();
    }

    @Test
    void owningOrManageableAllowsOwnerButNotCommittee() {
        login("OWNER");
        assertThatCode(() -> guard.verifyOwningOrManageable(council)).doesNotThrowAnyException();
        login("OTHER");
        when(committeeRepository.findByItPtlAsctIdAndEnoAndDelYn(ID, "USER-1", "N"))
                .thenReturn(Optional.of(mock(Bcmmtm.class)));
        assertThatThrownBy(() -> guard.verifyOwningOrManageable(council))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void committeeOrManageableAllowsCommitteeAndManagerOnly() {
        login("OTHER");
        assertThatThrownBy(() -> guard.verifyCommitteeOrManageable(council))
                .isInstanceOf(AccessDeniedException.class);
        when(committeeRepository.findByItPtlAsctIdAndEnoAndDelYn(ID, "USER-1", "N"))
                .thenReturn(Optional.of(mock(Bcmmtm.class)));
        assertThatCode(() -> guard.verifyCommitteeOrManageable(council)).doesNotThrowAnyException();
        when(committeeRepository.findByItPtlAsctIdAndEnoAndDelYn(ID, "USER-1", "N"))
                .thenReturn(Optional.empty());
        loginAs("ITPAD001");
        assertThatCode(() -> guard.verifyCommitteeOrManageable(council)).doesNotThrowAnyException();
        login("OWNER");
        assertThatThrownBy(() -> guard.verifyCommitteeOrManageable(council))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void creatableFollowsRoleAndDepartmentMatrix() {
        // 일반 사용자: 본인 부서 사업 03 허용, 타 부서 03 거부, 01·02·05 거부
        login("OWNER");
        assertThatCode(() -> guard.verifyCreatable("03", "PRJ-1", 1)).doesNotThrowAnyException();
        assertThatThrownBy(() -> guard.verifyCreatable("01", "PRJ-1", 1))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> guard.verifyCreatable("02", "PLN-1", null))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> guard.verifyCreatable("05", "PRJ-1", 1))
                .isInstanceOf(AccessDeniedException.class);
        login("OTHER");
        assertThatThrownBy(() -> guard.verifyCreatable("03", "PRJ-1", 1))
                .isInstanceOf(AccessDeniedException.class);
        // 일반 사용자 04: 정보보호 항목이 있어야 허용
        login("OWNER");
        when(projectItemRepository.existsByAbusMngNoAndSectSysUtzYnAndDelYn("PRJ-1", "Y", "N"))
                .thenReturn(false);
        assertThatThrownBy(() -> guard.verifyCreatable("04", "PRJ-1", 1))
                .isInstanceOf(AccessDeniedException.class);
        when(projectItemRepository.existsByAbusMngNoAndSectSysUtzYnAndDelYn("PRJ-1", "Y", "N"))
                .thenReturn(true);
        assertThatCode(() -> guard.verifyCreatable("04", "PRJ-1", 1)).doesNotThrowAnyException();
        // 정보보호관리자: 04만
        loginAs("ITPAD002");
        assertThatCode(() -> guard.verifyCreatable("04", "PRJ-9", 1)).doesNotThrowAnyException();
        assertThatThrownBy(() -> guard.verifyCreatable("03", "PRJ-1", 1))
                .isInstanceOf(AccessDeniedException.class);
        // 시스템관리자: 01·02·03·05 무조건, 04는 정보보호 항목 있을 때
        loginAs("ITPAD001");
        assertThatCode(() -> guard.verifyCreatable("02", "PLN-1", null)).doesNotThrowAnyException();
        assertThatCode(() -> guard.verifyCreatable("03", "PRJ-9", 1)).doesNotThrowAnyException();
        when(projectItemRepository.existsByAbusMngNoAndSectSysUtzYnAndDelYn("PRJ-9", "Y", "N"))
                .thenReturn(false);
        assertThatThrownBy(() -> guard.verifyCreatable("04", "PRJ-9", 1))
                .isInstanceOf(AccessDeniedException.class);
        when(projectItemRepository.existsByAbusMngNoAndSectSysUtzYnAndDelYn("PRJ-9", "Y", "N"))
                .thenReturn(true);
        assertThatCode(() -> guard.verifyCreatable("04", "PRJ-9", 1)).doesNotThrowAnyException();
    }

    @Test
    void creatableRejectsMissingAuthentication() {
        SecurityContextHolder.clearContext();
        assertThatThrownBy(() -> guard.verifyCreatable("03", "PRJ-1", 1))
                .isInstanceOf(AccessDeniedException.class);
    }
```

- [ ] **Step 3: 컴파일 실패를 확인한다**

Run: `./gradlew compileTestJava -q`
Expected: `CouncilAccessGuard` 생성자 인자 개수 불일치와 `verifyManageable` 등 미정의 메서드로 컴파일 오류.

- [ ] **Step 4: 가드를 구현한다**

`CouncilAccessGuard.java`에서 필드와 import를 추가하고 메서드를 구현한다.

import 추가:

```java
import com.kdb.it.domain.budget.project.repository.ProjectItemRepository;
import java.util.Set;
```

필드(기존 `committeeRepository` 아래):

```java
    private final ProjectItemRepository projectItemRepository;

    /** 시스템관리자가 정보보호 항목 판정 없이 신청할 수 있는 심의유형. 프론트 `roleDbrTcSet`과 같다. */
    private static final Set<String> ADMIN_CREATABLE_TYPES = Set.of("01", "02", "03", "05");
```

`lockWritableDraft` 아래에 공개 메서드 4개:

```java
    /**
     * 관리자(시스템관리자, 심의유형 04의 정보보호관리자)만 허용합니다. 평가위원 편성 같은 관리 액션에 사용합니다.
     *
     * @param council 활성 협의회 원장
     * @throws AccessDeniedException 인증 주체가 없거나 관리 권한이 없는 경우
     */
    public void verifyManageable(Basctm council) {
        CustomUserDetails user = currentUser();
        if (!canManage(council, user)) {
            throw new AccessDeniedException("협의회 관리 권한이 없습니다.");
        }
    }

    /**
     * 관리자 또는 활성 연결 사업의 주관부서를 허용합니다. 배정위원 자격만으로는 허용하지 않습니다.
     *
     * @param council 활성 협의회 원장
     * @throws AccessDeniedException 인증 주체가 없거나 주관부서·관리 권한이 없는 경우
     */
    public void verifyOwningOrManageable(Basctm council) {
        CustomUserDetails user = currentUser();
        if (!canManage(council, user) && !isOwningDepartment(council, user)) {
            throw new AccessDeniedException("협의회 주관부서 또는 관리자만 수행할 수 있습니다.");
        }
    }

    /**
     * 관리자 또는 해당 협의회의 활성 배정위원을 허용합니다. 사전 Q&A 질문 등록에 사용합니다.
     *
     * @param council 활성 협의회 원장
     * @throws AccessDeniedException 인증 주체가 없거나 위원·관리 권한이 없는 경우
     */
    public void verifyCommitteeOrManageable(Basctm council) {
        CustomUserDetails user = currentUser();
        if (canManage(council, user)) {
            return;
        }
        if (committeeRepository
                .findByItPtlAsctIdAndEnoAndDelYn(council.getItPtlAsctId(), user.getEno(), "N")
                .isPresent()) {
            return;
        }
        throw new AccessDeniedException("해당 협의회의 평가위원 또는 관리자만 수행할 수 있습니다.");
    }

    /**
     * 협의회 신청 가능 여부를 심의유형과 대상 사업으로 판정합니다. 원장이 아직 없으므로 키를 직접 받습니다.
     *
     * <p>시스템관리자는 01·02·03·05를 조건 없이, 04는 대상 사업에 정보보호 소요자원이 있을 때 신청합니다. 정보보호관리자는 04만
     * 신청합니다. 그 밖의 사용자는 대상 사업의 주관부서일 때 03을, 정보보호 소요자원까지 있을 때 04를 신청합니다.
     *
     * @param dbrTc 심의유형 코드
     * @param abusMngNo 대상 사업 관리번호(계획협의회는 계획관리번호)
     * @param sno 대상 사업 순번(계획협의회는 null)
     * @throws AccessDeniedException 인증 주체가 없거나 위 규칙에 맞지 않는 경우
     */
    public void verifyCreatable(String dbrTc, String abusMngNo, Integer sno) {
        CustomUserDetails user = currentUser();
        if (user.isAdmin() && ADMIN_CREATABLE_TYPES.contains(dbrTc)) {
            return;
        }
        if (user.isInfoSecAdmin() && "04".equals(dbrTc)) {
            return;
        }
        if (!"03".equals(dbrTc) && !"04".equals(dbrTc)) {
            throw new AccessDeniedException("신청할 수 없는 심의유형입니다: " + dbrTc);
        }
        if (user.isInfoSecAdmin() && !user.isAdmin()) {
            throw new AccessDeniedException("정보보호관리자는 정보보호시스템(04) 협의회만 신청할 수 있습니다.");
        }
        if (!user.isAdmin() && !isOwningProject(abusMngNo, sno, user)) {
            throw new AccessDeniedException("대상 사업의 주관부서만 협의회를 신청할 수 있습니다.");
        }
        if ("04".equals(dbrTc)
                && !projectItemRepository.existsByAbusMngNoAndSectSysUtzYnAndDelYn(
                        abusMngNo, "Y", "N")) {
            throw new AccessDeniedException("정보보호 소요자원이 없는 사업은 정보보호시스템(04) 협의회를 신청할 수 없습니다.");
        }
    }
```

기존 `isOwningDepartment`를 사업 키 헬퍼로 분리한다(기존 메서드 본문을 아래 두 메서드로 교체):

```java
    private boolean isOwningDepartment(Basctm council, CustomUserDetails user) {
        if ("02".equals(council.getItPtlAsctDbrTc())) {
            return false;
        }
        return isOwningProject(council.getAbusMngNo(), council.getSno(), user);
    }

    private boolean isOwningProject(String abusMngNo, Integer sno, CustomUserDetails user) {
        if (!StringUtils.hasText(user.getBbrC()) || !StringUtils.hasText(abusMngNo) || sno == null) {
            return false;
        }
        return projectRepository
                .findById(new BprojmId(abusMngNo, sno))
                .filter(project -> "N".equals(project.getDelYn()))
                .map(project -> OwnershipVerifier.canModify(null, project.getSvnDpmC(), user))
                .orElse(false);
    }
```

- [ ] **Step 5: 경계 테스트를 실행한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.service.CouncilAccessBoundaryTest' -q`
Expected: 기존 31건 + 신규 6건 전부 PASS.

- [ ] **Step 6: 포맷을 맞추고 커밋한다**

Run: `./gradlew spotlessApply -q && ./gradlew spotlessJavaCheck -q`

```bash
git add src/main/java/com/kdb/it/domain/council/service/CouncilAccessGuard.java src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java
git commit -m "feat(council): CouncilAccessGuard에 관리·주관부서·위원·신청 판정 추가 (COUNCIL-011)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: 평가위원 편성 권한·상태 가드

**Files:**
- Modify: `src/main/java/com/kdb/it/domain/council/service/CommitteeService.java`
- Test: `src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java`
- Test: `src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java`

**Interfaces:**
- Consumes: Task 1의 `CouncilAccessGuard.verifyManageable(Basctm)`.
- Produces: `CommitteeService` 생성자가 `(CommitteeRepository, UserRepository, CouncilService, CouncilAccessGuard)`가 된다. `saveCommittee`는 관리 권한 없음 403, 상태가 `04`·`05`가 아니면 409.

- [ ] **Step 1: 경계 테스트에 `CommitteeService`를 조립한다**

필드 추가:

```java
    @Mock UserRepository userRepository;
    private CommitteeService committeeService;
```

import 추가:

```java
import com.kdb.it.common.iam.repository.UserRepository;
```

`setUp()` 끝(`login("OTHER");` 앞)에 추가:

```java
        committeeService =
                new CommitteeService(committeeRepository, userRepository, councilService, guard);
        ReflectionTestUtils.setField(committeeService, "entityManager", entityManager);
```

헬퍼 추가:

```java
    private CouncilDto.CommitteeRequest committeeRequest() {
        return new CouncilDto.CommitteeRequest(
                "03", List.of(new CouncilDto.CommitteeMemberRequest("E-1", "02")));
    }
```

- [ ] **Step 2: 위원 편성 경계 테스트를 추가한다**

```java
    @Test
    void committeeSaveRejectsOwningDepartmentAndCommittee() {
        council.changeStatus("05");
        login("OWNER");
        assertThatThrownBy(() -> committeeService.saveCommittee(ID, committeeRequest()))
                .isInstanceOf(AccessDeniedException.class);
        login("OTHER");
        when(committeeRepository.findByItPtlAsctIdAndEnoAndDelYn(ID, "USER-1", "N"))
                .thenReturn(Optional.of(mock(Bcmmtm.class)));
        assertThatThrownBy(() -> committeeService.saveCommittee(ID, committeeRequest()))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(entityManager);
    }

    @Test
    void committeeSaveAllowsAdminInPreparationStatuses() {
        loginAs("ITPAD001");
        council.changeStatus("04");
        committeeService.saveCommittee(ID, committeeRequest());
        council.changeStatus("05");
        committeeService.saveCommittee(ID, committeeRequest());
        verify(entityManager, org.mockito.Mockito.times(2)).persist(any());
    }

    @Test
    void committeeSaveAllowsInfoSecManagerOnlyForInfoSecType() {
        loginAs("ITPAD002");
        council.changeStatus("05");
        assertThatThrownBy(() -> committeeService.saveCommittee(ID, committeeRequest()))
                .isInstanceOf(AccessDeniedException.class);
        ReflectionTestUtils.setField(council, "itPtlAsctDbrTc", "04");
        committeeService.saveCommittee(ID, committeeRequest());
        verify(entityManager).persist(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"01", "02", "03", "06", "07", "08", "09", "10", "11", "12", "13", "99"})
    void committeeSaveRejectsOtherStatusesWithConflict(String status) {
        loginAs("ITPAD001");
        council.changeStatus(status);
        assertThatThrownBy(() -> committeeService.saveCommittee(ID, committeeRequest()))
                .isInstanceOfSatisfying(
                        ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode().value()).isEqualTo(409));
        verifyNoInteractions(entityManager);
    }
```

- [ ] **Step 3: 컴파일 실패를 확인한다**

Run: `./gradlew compileTestJava -q`
Expected: `CommitteeService` 생성자 인자 4개 불일치로 컴파일 오류.

- [ ] **Step 4: `CommitteeService`를 수정한다**

필드 추가(기존 `councilService` 아래):

```java
    /** 평가위원 편성의 관리 권한 검사 */
    private final CouncilAccessGuard councilAccessGuard;
```

import 추가:

```java
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
```

상수 추가(필드 아래):

```java
    /** 평가위원을 편성·변경할 수 있는 진행상태: 요청서 결재 완료(04), 협의회 개최 준비(05) */
    private static final Set<String> COMMITTEE_EDITABLE_STATUSES = Set.of("04", "05");
```

`saveCommittee` 첫 줄 `councilService.findActiveCouncil(asctId);`를 다음으로 교체:

```java
        Basctm council = councilService.findActiveCouncil(asctId);
        // 권한을 상태보다 먼저 검사해 권한 없는 호출자에게 상태 정보를 노출하지 않는다.
        councilAccessGuard.verifyManageable(council);
        if (!COMMITTEE_EDITABLE_STATUSES.contains(council.getItPtlAsctPrgStsTc())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "평가위원을 편성할 수 있는 상태가 아닙니다. 협의회를 다시 조회해 주세요.");
        }
```

`Basctm` import가 없으면 추가: `import com.kdb.it.domain.council.entity.Basctm;`

- [ ] **Step 5: `CommitteeServiceTest`를 갱신한다**

필드 추가(`@Mock private CouncilService councilService;` 아래):

```java
    @Mock private CouncilAccessGuard councilAccessGuard;
```

`@DisplayName`이 `saveCommittee:`로 시작하는 테스트 2건의 첫 줄에 스텁을 넣는다(그 테스트는 `councilService`가 목이라 원장이 `null`로 돌아와 상태 검사에서 NPE가 난다):

```java
        when(councilService.findActiveCouncil(anyString()))
                .thenReturn(
                        Basctm.builder()
                                .itPtlAsctId("ASCT-2026-0001")
                                .itPtlAsctPrgStsTc("05")
                                .delYn("N")
                                .build());
```

필요 import: `import static org.mockito.ArgumentMatchers.anyString;`, `import com.kdb.it.domain.council.entity.Basctm;`

- [ ] **Step 6: 테스트를 실행한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.service.CouncilAccessBoundaryTest' --tests 'com.kdb.it.domain.council.service.CommitteeServiceTest' --tests 'com.kdb.it.domain.council.controller.CouncilCommitteeControllerTest' -q`
Expected: 전부 PASS(컨트롤러 테스트는 서비스를 목으로 쓰므로 영향 없음).

- [ ] **Step 7: 포맷을 맞추고 커밋한다**

Run: `./gradlew spotlessApply -q && ./gradlew spotlessJavaCheck -q`

```bash
git add src/main/java/com/kdb/it/domain/council/service/CommitteeService.java src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java
git commit -m "feat(council): 평가위원 편성에 관리 권한과 04·05 상태 가드 적용 (COUNCIL-011)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: 결재 상신 권한 가드

**Files:**
- Modify: `src/main/java/com/kdb/it/domain/council/service/CouncilApprovalService.java`
- Test: `src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java`
- Test: `src/test/java/com/kdb/it/domain/council/service/CouncilApprovalServiceTest.java`

**Interfaces:**
- Consumes: Task 1의 `CouncilAccessGuard.verifyOwningOrManageable(Basctm)`.
- Produces: `CouncilApprovalService` 생성자가 `(CouncilService, ProjectOverviewRepository, ApplicationService, CouncilAccessGuard)`가 된다. `requestApproval`은 권한 없음 403을 기존 `02` 검사보다 먼저 던진다.

- [ ] **Step 1: 경계 테스트에 `CouncilApprovalService`를 조립한다**

필드 추가:

```java
    @Mock ApplicationService applicationService;
    private CouncilApprovalService approvalService;
```

import 추가:

```java
import com.kdb.it.common.approval.service.ApplicationService;
```

`setUp()` 끝에 추가:

```java
        approvalService =
                new CouncilApprovalService(
                        councilService, projectOverviewRepository, applicationService, guard);
```

- [ ] **Step 2: 결재 상신 경계 테스트를 추가한다**

```java
    @Test
    void approvalRequestRejectsOtherDepartmentAndCommittee() {
        council.changeStatus("02");
        CustomUserDetails other = login("OTHER");
        assertThatThrownBy(
                        () ->
                                approvalService.requestApproval(
                                        ID, new CouncilDto.ApprovalRequest("E-9", null), other))
                .isInstanceOf(AccessDeniedException.class);
        when(committeeRepository.findByItPtlAsctIdAndEnoAndDelYn(ID, "USER-1", "N"))
                .thenReturn(Optional.of(mock(Bcmmtm.class)));
        assertThatThrownBy(
                        () ->
                                approvalService.requestApproval(
                                        ID, new CouncilDto.ApprovalRequest("E-9", null), other))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(applicationService, projectOverviewRepository);
    }

    @Test
    void approvalRequestChecksPermissionBeforeStatus() {
        // 작성중(01) 원장이라도 권한 없는 호출자는 상태 오류(400)가 아니라 403을 받는다.
        CustomUserDetails other = login("OTHER");
        assertThatThrownBy(
                        () ->
                                approvalService.requestApproval(
                                        ID, new CouncilDto.ApprovalRequest("E-9", null), other))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(applicationService, projectOverviewRepository);
    }

    @Test
    void approvalRequestPermissionAllowsOwnerAdminAndInfoSecForInfoSecType() {
        login("OWNER");
        assertThatCode(() -> guard.verifyOwningOrManageable(council)).doesNotThrowAnyException();
        loginAs("ITPAD001");
        assertThatCode(() -> guard.verifyOwningOrManageable(council)).doesNotThrowAnyException();
        loginAs("ITPAD002");
        assertThatThrownBy(() -> guard.verifyOwningOrManageable(council))
                .isInstanceOf(AccessDeniedException.class);
        ReflectionTestUtils.setField(council, "itPtlAsctDbrTc", "04");
        assertThatCode(() -> guard.verifyOwningOrManageable(council)).doesNotThrowAnyException();
    }
```

- [ ] **Step 3: 컴파일 실패를 확인한다**

Run: `./gradlew compileTestJava -q`
Expected: `CouncilApprovalService` 생성자 인자 4개 불일치로 컴파일 오류.

- [ ] **Step 4: `CouncilApprovalService`를 수정한다**

필드 추가(기존 `applicationService` 아래):

```java
    /** 결재 상신의 주관부서·관리 권한 검사 */
    private final CouncilAccessGuard councilAccessGuard;
```

`requestApproval`에서 `Basctm council = councilService.findActiveCouncil(asctId);` 바로 다음 줄, `// SUBMITTED 상태 확인` 주석 앞에 추가:

```java
        // 권한을 상태보다 먼저 검사한다. 배정위원은 상세를 볼 수 있지만 상신은 주관부서·관리자만 한다.
        councilAccessGuard.verifyOwningOrManageable(council);
```

- [ ] **Step 5: `CouncilApprovalServiceTest`에 목을 추가한다**

`@Mock private ApplicationService applicationService;` 아래:

```java
    @Mock private CouncilAccessGuard councilAccessGuard;
```

- [ ] **Step 6: 테스트를 실행한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.service.CouncilAccessBoundaryTest' --tests 'com.kdb.it.domain.council.service.CouncilApprovalServiceTest' --tests 'com.kdb.it.domain.council.controller.CouncilLifecycleControllerTest' -q`
Expected: 전부 PASS.

- [ ] **Step 7: 포맷을 맞추고 커밋한다**

Run: `./gradlew spotlessApply -q && ./gradlew spotlessJavaCheck -q`

```bash
git add src/main/java/com/kdb/it/domain/council/service/CouncilApprovalService.java src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java src/test/java/com/kdb/it/domain/council/service/CouncilApprovalServiceTest.java
git commit -m "feat(council): 결재 상신을 주관부서·관리자로 제한 (COUNCIL-011)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: 사전 Q&A 질문 권한 가드

**Files:**
- Modify: `src/main/java/com/kdb/it/domain/council/service/QnaService.java`
- Test: `src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java`
- Test: `src/test/java/com/kdb/it/domain/council/service/QnaServiceTest.java`

**Interfaces:**
- Consumes: Task 1의 `CouncilAccessGuard.verifyCommitteeOrManageable(Basctm)`.
- Produces: `QnaService` 생성자가 `(QnaRepository, CouncilRepository, ProjectRepository, CouncilAccessGuard)`가 된다. `createQna`는 위원·관리 권한 없음 403.

- [ ] **Step 1: 경계 테스트에 `QnaService`를 조립한다**

필드 추가:

```java
    @Mock QnaRepository qnaRepository;
    private QnaService qnaService;
```

import 추가:

```java
import com.kdb.it.domain.council.repository.QnaRepository;
```

`setUp()` 끝에 추가:

```java
        qnaService = new QnaService(qnaRepository, councilRepository, projectRepository, guard);
        ReflectionTestUtils.setField(qnaService, "entityManager", entityManager);
```

- [ ] **Step 2: Q&A 질문 경계 테스트를 추가한다**

```java
    @Test
    void qnaCreateRejectsUnrelatedUserAndOwningDepartment() {
        CustomUserDetails other = login("OTHER");
        assertThatThrownBy(
                        () ->
                                qnaService.createQna(
                                        ID, new CouncilDto.QnaCreateRequest("질문"), other))
                .isInstanceOf(AccessDeniedException.class);
        CustomUserDetails owner = login("OWNER");
        assertThatThrownBy(
                        () ->
                                qnaService.createQna(
                                        ID, new CouncilDto.QnaCreateRequest("질문"), owner))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(entityManager, qnaRepository);
    }

    @Test
    void qnaCreateAllowsCommitteeAndManagers() {
        CustomUserDetails member = login("OTHER");
        when(committeeRepository.findByItPtlAsctIdAndEnoAndDelYn(ID, "USER-1", "N"))
                .thenReturn(Optional.of(mock(Bcmmtm.class)));
        qnaService.createQna(ID, new CouncilDto.QnaCreateRequest("질문"), member);
        when(committeeRepository.findByItPtlAsctIdAndEnoAndDelYn(ID, "USER-1", "N"))
                .thenReturn(Optional.empty());
        CustomUserDetails admin = loginAs("ITPAD001");
        qnaService.createQna(ID, new CouncilDto.QnaCreateRequest("질문"), admin);
        CustomUserDetails infoSec = loginAs("ITPAD002");
        assertThatThrownBy(
                        () ->
                                qnaService.createQna(
                                        ID, new CouncilDto.QnaCreateRequest("질문"), infoSec))
                .isInstanceOf(AccessDeniedException.class);
        ReflectionTestUtils.setField(council, "itPtlAsctDbrTc", "04");
        qnaService.createQna(ID, new CouncilDto.QnaCreateRequest("질문"), infoSec);
        verify(entityManager, org.mockito.Mockito.times(3)).persist(any());
    }
```

- [ ] **Step 3: 컴파일 실패를 확인한다**

Run: `./gradlew compileTestJava -q`
Expected: `QnaService` 생성자 인자 4개 불일치로 컴파일 오류.

- [ ] **Step 4: `QnaService`를 수정한다**

필드 추가(기존 `projectRepository` 아래):

```java
    /** 사전 Q&A 질문 등록의 위원·관리 권한 검사 */
    private final CouncilAccessGuard councilAccessGuard;
```

`createQna`의 잠금 조회를 원장을 받는 형태로 바꾸고 권한 검사를 잇는다. 기존:

```java
        councilRepository
                .findByIdForUpdate(asctId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 협의회입니다: " + asctId));
```

교체:

```java
        Basctm council =
                councilRepository
                        .findByIdForUpdate(asctId)
                        .orElseThrow(
                                () -> new IllegalArgumentException("존재하지 않는 협의회입니다: " + asctId));
        // 질문은 해당 협의회 배정위원과 관리자만 남긴다. 추진부서 담당자는 답변 전용이다.
        councilAccessGuard.verifyCommitteeOrManageable(council);
```

`Basctm` import가 없으면 추가: `import com.kdb.it.domain.council.entity.Basctm;`

- [ ] **Step 5: `QnaServiceTest`에 목을 추가한다**

`@Mock private ProjectRepository projectRepository;` 아래:

```java
    @Mock private CouncilAccessGuard councilAccessGuard;
```

- [ ] **Step 6: 테스트를 실행한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.service.CouncilAccessBoundaryTest' --tests 'com.kdb.it.domain.council.service.QnaServiceTest' --tests 'com.kdb.it.domain.council.controller.CouncilQnaControllerTest' -q`
Expected: 전부 PASS.

- [ ] **Step 7: 포맷을 맞추고 커밋한다**

Run: `./gradlew spotlessApply -q && ./gradlew spotlessJavaCheck -q`

```bash
git add src/main/java/com/kdb/it/domain/council/service/QnaService.java src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java src/test/java/com/kdb/it/domain/council/service/QnaServiceTest.java
git commit -m "feat(council): 사전 Q&A 질문을 배정위원·관리자로 제한 (COUNCIL-011)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 협의회 신청 권한 가드

**Files:**
- Modify: `src/main/java/com/kdb/it/domain/council/service/CouncilService.java`
- Test: `src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java`

**Interfaces:**
- Consumes: Task 1의 `CouncilAccessGuard.verifyCreatable(String, String, Integer)`. `CouncilService`는 이미 `councilAccessGuard` 필드를 갖는다.
- Produces: `createCouncil`이 어떤 조회·채번보다 먼저 권한을 검사한다. `CouncilServiceTest`는 `@Mock CouncilAccessGuard`가 이미 있어 변경이 없다.

- [ ] **Step 1: 신청 경계 테스트를 추가한다**

```java
    @Test
    void councilCreateRejectsBeforeAnyPersistence() {
        CustomUserDetails other = login("OTHER");
        assertThatThrownBy(
                        () ->
                                councilService.createCouncil(
                                        new CouncilDto.CreateRequest("PRJ-1", 1, "03", null), other))
                .isInstanceOf(AccessDeniedException.class);
        CustomUserDetails owner = login("OWNER");
        assertThatThrownBy(
                        () ->
                                councilService.createCouncil(
                                        new CouncilDto.CreateRequest("PRJ-1", 1, "01", null), owner))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(
                        () ->
                                councilService.createCouncil(
                                        new CouncilDto.CreateRequest(null, null, "02", "PLN-1"), owner))
                .isInstanceOf(AccessDeniedException.class);
        verify(councilRepository, never()).getNextSequenceValue();
        verify(councilRepository, never()).findByAbusMngNoAndDelYn(any(), any());
        verifyNoInteractions(entityManager);
    }
```

- [ ] **Step 2: 테스트 실패를 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.service.CouncilAccessBoundaryTest' -q`
Expected: `councilCreateRejectsBeforeAnyPersistence` FAIL — `AccessDeniedException`이 아니라 채번·영속화로 진행하거나 NPE.

- [ ] **Step 3: `createCouncil`에 검사를 추가한다**

`CouncilService.createCouncil` 첫 줄(`boolean isPlanCouncil = ...` 앞)에 추가:

```java
        // 원장이 없으므로 심의유형과 사업 키로 신청 권한을 먼저 판정한다. 계획협의회는 관리자만 통과한다.
        councilAccessGuard.verifyCreatable(request.dbrTc(), request.prjMngNo(), request.prjSno());
```

- [ ] **Step 4: 테스트를 실행한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.service.CouncilAccessBoundaryTest' --tests 'com.kdb.it.domain.council.service.CouncilServiceTest' --tests 'com.kdb.it.domain.council.controller.CouncilControllerTest' -q`
Expected: 전부 PASS.

- [ ] **Step 5: 포맷을 맞추고 커밋한다**

Run: `./gradlew spotlessApply -q && ./gradlew spotlessJavaCheck -q`

```bash
git add src/main/java/com/kdb/it/domain/council/service/CouncilService.java src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java
git commit -m "feat(council): 협의회 신청을 심의유형·주관부서·정보보호 항목으로 제한 (COUNCIL-011)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: 전체 검증과 완료 기록

**Files:**
- Modify: `C:\it\TASK_COUNCIL.md`
- Modify: `C:\it\TASK_COUNCIL_DONE.md`
- Move: `C:\it\docs\superpowers\specs\2026-09-20-council-write-boundaries-design.md` → `C:\it\docs\superpowers\specs\done\`
- Move: `C:\it\docs\superpowers\plans\2026-09-20-council-write-boundaries.md` → `C:\it\docs\superpowers\plans\done\`

**Interfaces:**
- Consumes: Task 1~5의 커밋.
- Produces: 검증 수치가 기록된 완료 이력과 활성 표에서 제거된 COUNCIL-011.

- [ ] **Step 1: council 도메인 전체 테스트를 실행한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.*' -q`
Expected: BUILD SUCCESSFUL. 건수는 `build/test-results/test/TEST-com.kdb.it.domain.council.*.xml`의 `tests`·`failures`·`errors` 합으로 확인한다(failures=0, errors=0).

- [ ] **Step 2: 백엔드 전체 게이트를 실행한다**

Run: `./gradlew test -q && ./gradlew spotlessJavaCheck -q`
Expected: BUILD SUCCESSFUL, failures=0, errors=0. 실패가 있으면 원인을 고치기 전에 멈추고 보고한다.

- [ ] **Step 3: `TASK_COUNCIL_DONE.md`에 기록을 추가한다**

`## 2026-09-20` 절 끝에 추가(건수는 Step 1·2의 실제 값으로 채운다):

```markdown
| COUNCIL-011 | ✅ Done | `CouncilAccessGuard`에 `verifyManageable`·`verifyOwningOrManageable`·`verifyCommitteeOrManageable`·`verifyCreatable`을 추가하고 평가위원 편성(관리자, 상태 04·05만, 위반 409)·결재 상신(주관부서·관리자)·사전 Q&A 질문(배정위원·관리자)·협의회 신청(관리자 01/02/03/05, 정보보호관리자 04, 일반부서는 주관 사업 03·정보보호 항목 있으면 04, 관리자 04도 정보보호 항목 필요)에 적용 | [설계](docs/superpowers/specs/done/2026-09-20-council-write-boundaries-design.md) · [계획](docs/superpowers/plans/done/2026-09-20-council-write-boundaries.md) |

코드 변경(COUNCIL-011): `it_backend` — `CouncilAccessGuard.java`, `CommitteeService.java`, `CouncilApprovalService.java`, `QnaService.java`, `CouncilService.java`, `CouncilAccessBoundaryTest.java`, `CommitteeServiceTest.java`, `CouncilApprovalServiceTest.java`, `QnaServiceTest.java`. 컨트롤러·DTO·DB·프론트 변경 없음.

검증 결과(COUNCIL-011):

- `CouncilAccessBoundaryTest` (기존 31건 + 신규 N건) 통과 — 가드 판정 행렬, 위원 편성 권한·상태(04·05 허용, 그 밖의 12개 상태 409), 결재 상신 권한 우선(403 → 400 순), Q&A 질문 위원·관리자, 신청 거부 시 채번·영속화 미호출.
- `com.kdb.it.domain.council.*` N건 통과, 실패 0.
- 백엔드 전체 `./gradlew test` N건 통과, 실패 0. `spotlessJavaCheck` 통과.

미검증 범위(COUNCIL-011): 사전 Q&A 질문의 단계별 허용 시점(상태 가드 미적용), 결재 상신 원장 잠금(COUNCIL-012), 조회 API 11개(COUNCIL-013), 운영 사용자 연동.
```

- [ ] **Step 4: `TASK_COUNCIL.md`에서 COUNCIL-011 행을 제거한다**

활성 과제 표에서 `| COUNCIL-011 | 높음 | 진행 | ...` 행 한 줄을 삭제한다. `ID 최대 번호(활성·완료 합산): COUNCIL-013.`은 그대로 둔다.

- [ ] **Step 5: 설계·계획 문서를 `done/`으로 옮기고 링크를 고친다**

```bash
cd C:\it
git mv docs/superpowers/specs/2026-09-20-council-write-boundaries-design.md docs/superpowers/specs/done/
git mv docs/superpowers/plans/2026-09-20-council-write-boundaries.md docs/superpowers/plans/done/
```

옮긴 설계 문서 3~4행의 상대 링크를 한 단계 깊게 고친다:

- `../../../TASK_COUNCIL.md` → `../../../../TASK_COUNCIL.md` (두 곳)
- `done/2026-09-20-council-access-and-draft-protection.md` → `2026-09-20-council-access-and-draft-protection.md`

옮긴 계획 문서의 `**Spec:**` 경로는 `docs/superpowers/specs/done/2026-09-20-council-write-boundaries-design.md`로 고친다.

- [ ] **Step 6: 루트 문서를 커밋한다**

```bash
cd C:\it
git add TASK_COUNCIL.md TASK_COUNCIL_DONE.md docs/superpowers/specs/done/2026-09-20-council-write-boundaries-design.md docs/superpowers/plans/done/2026-09-20-council-write-boundaries.md
git commit -m "docs(council): COUNCIL-011 완료 기록 및 설계·계획 문서 이동

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

푸시는 사용자 확인 후 `it_backend`와 루트를 함께 올린다.
