# Clean Code Wave 3 Wave A Backend Refactors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CQ-17의 사용자 자격등급 조회 정책을 단일 컴포넌트로 통합하고, CQ-06의 `Bcostm.update` 20개 위치 인자를 명시적인 builder record 명령으로 교체한다.

**Architecture:** 사용자 자격등급 해석은 IAM 데이터와 기본 역할 정책을 함께 소유하므로 `common.iam.service.UserRoleResolver`가 담당하고 로그인·세션 복원·개발 사용자 전환·SSO·Refresh가 모두 이를 호출한다. `Bcostm`은 필드명이 드러나는 `@Builder UpdateCommand`를 최종 변경 API로 사용하며, `CodeDefaults` 보정은 엔티티의 `update(UpdateCommand)` 안에 유지한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Data JPA, Lombok, JUnit 5, Mockito, AssertJ, Gradle, Spotless, JaCoCo

## Global Constraints

- 모든 신규 JavaDoc과 주석은 한글로 작성하고 public 메서드에는 입력값·반환값·실패 조건을 기록한다.
- 외부 REST API, DTO, DB 스키마, 트랜잭션 경계와 인증 실패 의미는 변경하지 않는다.
- 역할 조회 조건은 `eno`, `useYn='Y'`, `delYn='N'`을 유지하고 결과가 비면 `CustomUserDetails.ATH_USER` 하나를 반환한다.
- `AuthService`의 로그인·세션 복원·개발 사용자 전환·SSO 네 경로와 `RefreshTokenRotator`의 Refresh 경로를 모두 전환한다.
- `Bcostm.UpdateCommand`는 immutable record와 Lombok `@Builder`를 함께 사용해 모든 호출 인자에 필드명을 노출한다.
- `CodeDefaults.orNotApplicable` 보정 대상인 `dfrCleC`와 `abusTc`는 record 생성 시점이 아니라 `Bcostm.update(UpdateCommand)`에서 보정한다.
- `Btermm.update` 15개 인자와 관련 테스트는 CQ-19로 분리하며 이번 구현에서 변경하지 않는다.
- 각 리팩터링은 테스트 실패 확인 → 최소 구현 → 대상 테스트 통과 → 독립 커밋 순서로 수행한다.
- 최종 게이트는 `it_backend`의 `./gradlew check`이며 Spotless·단위 테스트·JaCoCo 검증을 모두 통과해야 한다.

## Execution Preconditions

- 구현 시작 전 root 계획 문서가 별도 커밋으로 추적되고 `TASK.md`, `TASK_DONE.md`, 이 실행계획, 상위 로드맵의 targeted status가 깨끗해야 한다.
- 다음 명령에 출력이 있으면 구현자는 문서 소유자의 기존 변경과 섞지 말고 중단한 뒤 계획 문서 격리 또는 커밋을 요청한다.

```powershell
git -C C:\it status --short -- `
  TASK.md `
  TASK_DONE.md `
  docs/superpowers/plans/2026-07-29-clean-code-wave3-remaining-debt.md `
  docs/superpowers/plans/2026-07-29-clean-code-wave3-wave-a-backend-refactors.md
```

- backend 작업 시작 전에도 `git -C C:\it\it_backend status --short`를 확인한다. 기존 변경이 있으면 새 worktree를 사용하고 사용자 변경을 stage·수정·되돌리지 않는다.
- 아래 커밋 명령은 해당 task의 명시된 파일만 stage한다. `git add .`, `git add -A`, 경로 없는 `git commit -a`는 사용하지 않는다.

---

## Review Decisions

| 결정 | 확정안 | 근거 |
| --- | --- | --- |
| CQ-17 컴포넌트 위치 | `common.iam.service.UserRoleResolver` | `RoleRepository`와 역할 정책은 IAM 책임이며 기존 `AuthorOrgResolver`·`OrgNameResolver`와 같은 경계를 재사용한다. |
| CQ-17 트랜잭션 | `@Transactional(readOnly = true)` | 독립 호출에서도 읽기 전용 계약을 보장하고 기존 쓰기 트랜잭션에서는 같은 트랜잭션에 참여한다. |
| CQ-17 반환 계약 | Repository 반환 순서 보존·변경 불가 목록, 빈 결과는 `ATH_USER` | 정렬 없는 Repository에 결정적 DB 순서를 새로 약속하지 않고 현재 `Stream.toList()`·`List.of()` 동작만 고정한다. |
| CQ-06 명령 생성 | `@Builder public record UpdateCommand(...)` | 20개 중 다수가 `String`이므로 정규 생성자는 위치 교환 위험을 남긴다. builder가 이름을 드러낸다. |
| CQ-06 호환 오버로드 | 구현 중 임시 사용 후 같은 작업에서 제거 | 전체 소스가 컴파일되는 TDD 전환점은 제공하되 최종 API를 둘로 남기지 않는다. |
| CQ-06 운영 호출부 | `CostService.java`의 `Bcostm target.update` 한 곳 | 기존 계획의 두 번째 호출부는 `Btermm existing.update`로 확인되어 CQ-06 대상이 아니다. |

## What Already Exists

- `RoleRepository.findAllByIdEnoAndUseYnAndDelYn`이 필요한 활성·미삭제 필터를 이미 제공한다. 새 쿼리나 Repository 메서드를 만들지 않는다.
- `AuthService.loadAthIds`와 `RefreshTokenRotator.loadAthIds`가 동일 정책을 구현한다. 새 로직을 설계하지 않고 이 구현을 한 곳으로 이동한다.
- `common.iam.service.AuthorOrgResolver`와 `OrgNameResolver`가 `@Component`·생성자 주입·읽기 전용 트랜잭션 패턴을 제공한다.
- `Bprojm.UpdateCommand`가 엔티티 중첩 record 선례를, `NotificationEvent`가 Lombok `@Builder` record 선례를 제공한다.
- `AuthServiceTest`, `RefreshTokenRotatorTest`, `CostServiceTest`가 다섯 소비 경로와 금액 보정 회귀를 이미 검증한다. 새 단위 테스트와 함께 이 안전망을 재배선한다.

## NOT in Scope

- `Btermm.update` 15개 인자 전환: CQ-19로 별도 추적해 CQ-06의 작고 닫힌 변경 범위를 유지한다.
- CQ-01의 `CostService`·대형 서비스 분해: 이번 변경은 기존 서비스 경계를 바꾸지 않는다.
- CQ-15·CQ-16 프론트 구조 작업: 별도 저장소·별도 실패 표면이므로 후속 실행계획에서 다룬다.
- 역할 정렬·중복 제거 정책 추가: 현재 조회 결과의 순서와 중복 의미를 그대로 보존한다.
- 역할 조회 실패를 새 인증 예외로 변환: 기존처럼 Spring Data 예외를 원본 그대로 전파한다.
- API·DB·Flyway 변경: 공개 계약과 물리 데이터 모델 변화가 없다.
- `versions.lock` 갱신: API 호환 조합 변화가 없는 내부 리팩터링이며 현재 프론트 작업 브랜치를 릴리스 조합으로 잘못 고정하지 않는다.

## Data Flow

```text
PASSWORD LOGIN ───────────────┐
SESSION RESTORE ──────────────┤
DEV USER SWITCH ──────────────┼─> UserRoleResolver.resolveAthIds(eno)
SSO TOKEN ISSUE ──────────────┤          │
REFRESH TOKEN ROTATION ───────┘          ├─> RoleRepository(eno, "Y", "N")
                                         ├─> CroleI::getAthId
                                         └─> empty ? [ATH_USER] : immutable athIds
                                                       │
                                                       └─> JWT claims / LoginResponse

CostDto.UpdateRequest
        │ 서버 환율·금액·날짜 보정
        v
Bcostm.UpdateCommand.builder()
        │ 이름이 드러나는 20개 필드
        v
Bcostm.update(command)
        ├─> dfrCleC = CodeDefaults.orNotApplicable(...)
        ├─> abusTc   = CodeDefaults.orNotApplicable(...)
        └─> 나머지 필드 대입 → JPA Dirty Checking
```

## Diagram Placement

- 위 두 흐름은 계획 문서에서만 유지한다.
- `UserRoleResolver`는 단일 조회·매핑·폴백으로 끝나고 `Bcostm.update`는 직선형 필드 대입이므로 production 코드에 ASCII 다이어그램을 추가하지 않는다.
- `AuthService`와 `RefreshTokenRotator`의 기존 Refresh 회전·잠금 설명은 그대로 유지하며 이번 리팩터링으로 의미가 달라지지 않는다.

## Performance Review

- 역할 조회는 각 인증 진입점당 기존과 동일한 Repository 호출 1회다. 새 조회, 반복 조회, N+1(목록 건수만큼 추가 조회가 발생하는 패턴), 캐시 무효화 문제를 만들지 않는다.
- resolver 프록시 호출과 builder record 객체 1개 할당은 DB·JWT·트랜잭션 비용에 비해 무시할 수 있으며 별도 캐시나 객체 풀을 도입하지 않는다.
- 역할 캐시는 로그인·Refresh 시 최신 역할을 다시 읽는 인증 정책과 충돌하므로 도입하지 않는다.
- `Bcostm` 변경은 JPA Dirty Checking과 SQL 수를 바꾸지 않는다.

## Failure Modes

| 코드 경로 | 현실적 실패 | 테스트 | 오류 처리 | 사용자 영향 |
| --- | --- | --- | --- | --- |
| 역할 다건 조회 | Repository가 반환한 역할 순서 또는 값이 추출 과정에서 변형됨 | `UserRoleResolverTest`에서 Repository 반환 순서·값·불변성 검증 | 원본 목록을 immutable snapshot으로 반환 | 잘못된 JWT 권한 대신 테스트에서 차단 |
| 역할 없음 | 빈 `athIds`가 JWT에 들어감 | resolver 폴백 테스트 + 로그인 외부 계약 테스트 | `ATH_USER` 폴백 | 일반 사용자 권한으로 정상 로그인 |
| 역할 DB 조회 | Repository 예외가 삼켜짐 | 원본 예외 동일성 테스트 | 변환 없이 전파 | 로그인·Refresh가 명시적으로 실패하며 silent failure 없음 |
| 소비자 전환 | 로그인·세션·개발 전환·SSO·Refresh 중 한 곳이 구 구현에 남음 | 기존 소비자 테스트 재배선 + `loadAthIds` grep 0건 | 컴파일과 grep 게이트 | 권한 정책 분기 재발 방지 |
| `UpdateCommand` 조립 | 같은 타입의 필드가 뒤바뀜 | builder accessor와 `CostServiceTest` captor 검증 | 필드명 기반 builder | 잘못된 비용 데이터 저장을 테스트에서 차단 |
| `UpdateCommand` 누락 | null 명령으로 필드 적용 도중 부분 변경됨 | 엔티티 단위 테스트에서 명시적 null 계약 검증 | 대입 전 `Objects.requireNonNull` | 부분 변경 없이 즉시 실패 |
| 기본값 보정 | `dfrCleC`·`abusTc`가 null/blank로 저장됨 | 엔티티 단위 테스트에서 두 경계값 검증 | 엔티티 update에서 기존 보정 유지 | Oracle NOT NULL 오류 방지 |
| 금액 회귀 | `costTotXpAmt`·`fcAmt` 매핑이 바뀜 | 기존 환율 회귀 테스트를 command captor로 유지 | 서버 계산 후 command에 전달 | 저장 금액 왜곡을 테스트에서 차단 |

Critical gaps: 없음. 모든 신규 실패 경로는 테스트 또는 기존 명시적 예외 전파로 관찰 가능하며 silent failure가 없다.

## File Map

| 파일 | 역할 |
| --- | --- |
| `it_backend/src/main/java/com/kdb/it/common/iam/service/UserRoleResolver.java` | 활성 역할 조회·`ATH_USER` 폴백의 단일 정책 소유자 |
| `it_backend/src/test/java/com/kdb/it/common/iam/service/UserRoleResolverTest.java` | 조회 조건·다건 결과·불변성·폴백·예외 전파 검증 |
| `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java` | 네 인증 진입점에서 resolver 사용 |
| `it_backend/src/main/java/com/kdb/it/common/system/service/RefreshTokenRotator.java` | Refresh 회전에서 resolver 사용 |
| `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java` | 네 인증 진입점의 resolver 결과 전달 계약 검증 |
| `it_backend/src/test/java/com/kdb/it/common/system/service/RefreshTokenRotatorTest.java` | Refresh 경로의 resolver 결과 전달 계약 검증 |
| `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java` | builder record 명령과 필드·기본값 적용 |
| `it_backend/src/test/java/com/kdb/it/domain/budget/cost/entity/BcostmUpdateCommandTest.java` | 20개 필드 매핑과 기본값 보정 검증 |
| `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java` | 서버 보정 결과를 이름 기반 command로 조립 |
| `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java` | command captor로 계약명·원화·외화 금액 회귀 검증 |

---

### Task 1: IAM 역할 해석 정책 추출

**Files:**

- Create: `it_backend/src/test/java/com/kdb/it/common/iam/service/UserRoleResolverTest.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/iam/service/UserRoleResolver.java`

**Interfaces:**

- Consumes: `RoleRepository.findAllByIdEnoAndUseYnAndDelYn(String eno, String useYn, String delYn)`
- Produces: `List<String> UserRoleResolver.resolveAthIds(String eno)`

- [ ] **Step 1: 역할 해석기의 실패하는 단위 테스트 작성**

```java
package com.kdb.it.common.iam.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.kdb.it.common.iam.entity.CroleI;
import com.kdb.it.common.iam.repository.RoleRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataRetrievalFailureException;

@ExtendWith(MockitoExtension.class)
class UserRoleResolverTest {

    @Mock private RoleRepository roleRepository;
    @InjectMocks private UserRoleResolver resolver;

    @Test
    void resolveAthIds_활성역할다건_순서보존불변목록반환() {
        CroleI admin = mock(CroleI.class);
        CroleI manager = mock(CroleI.class);
        given(admin.getAthId()).willReturn("ITPAD001");
        given(manager.getAthId()).willReturn("ITPZZ002");
        given(roleRepository.findAllByIdEnoAndUseYnAndDelYn("10001", "Y", "N"))
                .willReturn(List.of(admin, manager));

        List<String> result = resolver.resolveAthIds("10001");

        assertThat(result).containsExactly("ITPAD001", "ITPZZ002");
        assertThatThrownBy(() -> result.add("ITPZZ001"))
                .isInstanceOf(UnsupportedOperationException.class);
        verify(roleRepository).findAllByIdEnoAndUseYnAndDelYn("10001", "Y", "N");
    }

    @Test
    void resolveAthIds_활성역할없음_일반사용자폴백() {
        given(roleRepository.findAllByIdEnoAndUseYnAndDelYn("10001", "Y", "N"))
                .willReturn(List.of());

        assertThat(resolver.resolveAthIds("10001"))
                .containsExactly(CustomUserDetails.ATH_USER);
    }

    @Test
    void resolveAthIds_조회실패_SpringData원본예외전파() {
        DataRetrievalFailureException repositoryError =
                new DataRetrievalFailureException("역할 조회 실패");
        given(roleRepository.findAllByIdEnoAndUseYnAndDelYn("10001", "Y", "N"))
                .willThrow(repositoryError);

        assertThatThrownBy(() -> resolver.resolveAthIds("10001")).isSameAs(repositoryError);
    }
}
```

- [ ] **Step 2: 테스트가 구현 부재로 실패하는지 확인**

Run:

```powershell
cd C:\it\it_backend
.\gradlew.bat test --tests "com.kdb.it.common.iam.service.UserRoleResolverTest"
```

Expected: `UserRoleResolver` 심볼을 찾을 수 없어 `compileTestJava`가 실패한다.

- [ ] **Step 3: 최소 역할 해석기 구현**

```java
package com.kdb.it.common.iam.service;

import com.kdb.it.common.iam.entity.CroleI;
import com.kdb.it.common.iam.repository.RoleRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사용자 자격등급 공통 해석기.
 *
 * <p>활성·미삭제 역할만 조회하고 역할이 없는 사용자는 일반 사용자 자격등급으로 보정합니다.
 */
@Component
@RequiredArgsConstructor
public class UserRoleResolver {

    private final RoleRepository roleRepository;

    /**
     * 사용자의 현재 활성 자격등급 목록을 해석합니다.
     *
     * @param eno 역할을 조회할 사용자 사번
     * @return 조회 순서를 유지하는 변경 불가 자격등급 목록. 활성 역할이 없으면 {@code ATH_USER} 단일 목록
     * @throws org.springframework.dao.DataAccessException 역할 조회에 실패한 경우
     */
    @Transactional(readOnly = true)
    public List<String> resolveAthIds(String eno) {
        List<String> athIds =
                roleRepository.findAllByIdEnoAndUseYnAndDelYn(eno, "Y", "N").stream()
                        .map(CroleI::getAthId)
                        .toList();
        return athIds.isEmpty() ? List.of(CustomUserDetails.ATH_USER) : athIds;
    }
}
```

- [ ] **Step 4: resolver 단위 테스트 통과 확인**

Run:

```powershell
.\gradlew.bat test --tests "com.kdb.it.common.iam.service.UserRoleResolverTest"
```

Expected: `BUILD SUCCESSFUL`, 테스트 3건 통과.

- [ ] **Step 5: CQ-17 원자적 변경을 위해 커밋하지 않고 Task 2로 진행**

resolver만 도입한 미사용 중간 상태를 독립 커밋으로 남기지 않는다. 이 시점에는 두 신규 파일만 작업 트리에 둔 채 Task 2의 모든 소비자 전환과 함께 하나의 CQ-17 커밋으로 묶는다.

---

### Task 2: 모든 인증 소비자를 `UserRoleResolver`로 전환

**Files:**

- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java:4,67-68,188,313,397,442,496-502`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/RefreshTokenRotator.java:4,54,125,180-186`
- Modify: `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java:14-16,55,76-101,178-197,227-272,315-337,576-741`
- Modify: `it_backend/src/test/java/com/kdb/it/common/system/service/RefreshTokenRotatorTest.java:14,46,60-159,304-337`

**Interfaces:**

- Consumes: `List<String> UserRoleResolver.resolveAthIds(String eno)`
- Produces: 로그인·세션 복원·개발 전환·SSO·Refresh가 동일 resolver 결과를 JWT와 응답 DTO에 전달

- [ ] **Step 1: 소비자 테스트의 의존성을 resolver로 먼저 교체**

`AuthServiceTest`에서 `RoleRepository`, `CroleI`, 역할 stub에만 쓰이던 `Collections` import와 `RoleRepository` mock을 제거하고 다음 mock을 추가한다.

```java
import com.kdb.it.common.iam.service.UserRoleResolver;

@Mock private UserRoleResolver userRoleResolver;
```

역할 조회까지 도달하는 다음 테스트에 resolver 반환값을 명시한다.

```java
given(userRoleResolver.resolveAthIds("10001"))
        .willReturn(List.of(CustomUserDetails.ATH_USER));
```

위 기본 역할 stub을 넣을 테스트:

- `login_성공_LoginResponse반환`
- `login_토큰발급중예외_LoginRejectedException으로변환되지않음`
- `login_성공_기존RefreshToken삭제후저장`
- `login_성공_성공이력저장`
- `login_빈역할목록_ITPZZ001폴백`

JWT를 발급하는 모든 테스트에서는 `anyList()`로 역할 인자를 허용하지 않는다. 각 테스트의 resolver stub과 `generateAccessToken` stub·verify가 같은 정확한 목록을 사용하게 바꾸고, 대표 경로에는 서로 구별 가능한 역할 목록을 사용해 resolver 결과가 토큰 발급과 응답에 그대로 전달되는지 고정한다.

```java
// login_활성자격등급있음_토큰클레임반영
List<String> loginAthIds = List.of("ITPAD001");
given(userRoleResolver.resolveAthIds("10001")).willReturn(loginAthIds);
given(jwtUtil.generateAccessToken("10001", loginAthIds, "BBR001"))
        .willReturn("access-token");
// Act 이후
verify(jwtUtil).generateAccessToken("10001", loginAthIds, "BBR001");

// issueSsoTokens_사용자존재_토큰발급
List<String> ssoAthIds = List.of("ITPAD001", "ITPZZ002");
given(userRoleResolver.resolveAthIds("10001")).willReturn(ssoAthIds);
given(jwtUtil.generateAccessToken("10001", ssoAthIds, "BBR001"))
        .willReturn("access-token");
// Act 이후
assertThat(response.getAthIds()).containsExactlyElementsOf(ssoAthIds);
verify(jwtUtil).generateAccessToken("10001", ssoAthIds, "BBR001");

// issueDevSwitchTokens_사용자존재_토큰발급
List<String> devAthIds = List.of("ITPZZ002");
given(userRoleResolver.resolveAthIds("10001")).willReturn(devAthIds);
given(jwtUtil.generateAccessToken("10001", devAthIds, "BBR001"))
        .willReturn("access-token");
// Act 이후
assertThat(response.getAthIds()).containsExactlyElementsOf(devAthIds);
verify(jwtUtil).generateAccessToken("10001", devAthIds, "BBR001");
```

사용자별 역할을 확인하는 두 테스트는 다음처럼 고정한다.

```java
// getSessionUser_인증사용자_최신정보반환
given(userRoleResolver.resolveAthIds("10001")).willReturn(List.of("ITPZZ002"));

// login_활성자격등급있음_토큰클레임반영
given(userRoleResolver.resolveAthIds("10001")).willReturn(List.of("ITPAD001"));
```

`login_빈역할목록_ITPZZ001폴백`은 resolver가 이미 보정한 결과를 서비스가 보존하는 외부 계약임을 드러내도록 다음 값으로 이름과 설명을 바꾼다.

- `@DisplayName`: `login - 역할 해석기의 기본 자격등급을 응답과 토큰 발급에 반영한다`
- 메서드명: `login_resolver기본역할_ITPZZ001반영`
- Arrange 주석: `역할 해석기가 반환한 기본 자격등급을 로그인 응답과 JWT 발급에 그대로 사용한다.`
- JWT stub과 검증: `generateAccessToken("10001", List.of(CustomUserDetails.ATH_USER), null)`을 정확히 사용한다. 이 테스트의 user builder에 `bbrC`를 넣는 경우에는 그 명시값으로 기대값도 함께 바꾼다.

`RefreshTokenRotatorTest`에서 `RoleRepository`, 역할 stub에만 쓰이던 `Collections` import와 `RoleRepository` mock을 제거하고 다음 mock을 추가한다.

```java
import com.kdb.it.common.iam.service.UserRoleResolver;

@Mock private UserRoleResolver userRoleResolver;
```

다음 세 테스트의 기존 Repository stub을 resolver stub으로 교체한다.

```java
// rotate_활성토큰_정상회전_결과반환
List<String> refreshAthIds = List.of("ITPAD002");
given(userRoleResolver.resolveAthIds("10001")).willReturn(refreshAthIds);
given(jwtUtil.generateAccessToken("10001", refreshAthIds, "BBR001"))
        .willReturn("new-access");
// Act 이후
verify(jwtUtil).generateAccessToken("10001", refreshAthIds, "BBR001");
```

- `rotate_활성토큰_정상회전_결과반환`
- `rotate_회전후활성토큰2개이상_IllegalStateException`
- `rotate_저장중DB오류_원본예외전파`

나머지 두 Refresh 오류 테스트도 `List.of(CustomUserDetails.ATH_USER)`를 resolver에서 반환하고 `generateAccessToken("10001", List.of(CustomUserDetails.ATH_USER), "BBR001")`을 정확히 stub한다. 오류가 토큰 생성 뒤 발생하는 테스트는 같은 정확값 verify를 추가한다.

- [ ] **Step 2: 소비자 테스트가 구 production 의존성 때문에 실패하는지 확인**

Run:

```powershell
.\gradlew.bat test `
  --tests "com.kdb.it.common.system.service.AuthServiceTest" `
  --tests "com.kdb.it.common.system.service.RefreshTokenRotatorTest"
```

Expected: production 클래스가 아직 `RoleRepository`를 직접 사용하므로 역할 조회 경로가 실패한다.

- [ ] **Step 3: `AuthService`의 네 호출부를 resolver로 전환**

`RoleRepository` import와 필드를 제거하고 resolver를 주입한다.

```java
import com.kdb.it.common.iam.service.UserRoleResolver;

/** 사용자 자격등급 조회와 기본 역할 보정을 담당하는 공통 해석기 */
private final UserRoleResolver userRoleResolver;
```

다음 네 줄을 모두 같은 호출로 바꾼다.

```java
List<String> athIds = userRoleResolver.resolveAthIds(eno);
```

- `login`: 기존 `AuthService.java:188`
- `getSessionUser`: 기존 `AuthService.java:313`
- `issueDevSwitchTokens`: 기존 `AuthService.java:397`
- `issueSsoTokens`: 기존 `AuthService.java:442`

마지막으로 `AuthService.java:496-502`의 private `loadAthIds` 메서드와 더 이상 쓰지 않는 `RoleRepository`·`CustomUserDetails` import를 제거한다. `CustomUserDetails`가 다른 코드에서 쓰이지 않는지 IDE 또는 `rg` 결과로 확인한 뒤 제거한다.

- [ ] **Step 4: `RefreshTokenRotator`의 Refresh 호출부를 resolver로 전환**

`RoleRepository`와 `CustomUserDetails` import·필드를 제거하고 resolver를 주입한다.

```java
import com.kdb.it.common.iam.service.UserRoleResolver;

private final UserRoleResolver userRoleResolver;
```

`RefreshTokenRotator.java:125`를 다음처럼 바꾸고 `:180-186` private 메서드를 제거한다.

```java
List<String> athIds = userRoleResolver.resolveAthIds(eno);
```

- [ ] **Step 5: 소비자 테스트와 중복 제거 게이트 확인**

Run:

```powershell
.\gradlew.bat test `
  --tests "com.kdb.it.common.iam.service.UserRoleResolverTest" `
  --tests "com.kdb.it.common.system.service.AuthServiceTest" `
  --tests "com.kdb.it.common.system.service.RefreshTokenRotatorTest"
rg -n "loadAthIds" src/main/java
rg -n "RoleRepository" `
  src/main/java/com/kdb/it/common/system/service/AuthService.java `
  src/main/java/com/kdb/it/common/system/service/RefreshTokenRotator.java
```

Expected:

- `BUILD SUCCESSFUL`
- `loadAthIds` 검색 결과 0건
- 두 소비자 파일의 `RoleRepository` 검색 결과 0건

- [ ] **Step 6: resolver와 인증 소비자 전환을 하나의 CQ-17 커밋으로 생성**

```powershell
git add src/main/java/com/kdb/it/common/iam/service/UserRoleResolver.java
git add src/test/java/com/kdb/it/common/iam/service/UserRoleResolverTest.java
git add src/main/java/com/kdb/it/common/system/service/AuthService.java
git add src/main/java/com/kdb/it/common/system/service/RefreshTokenRotator.java
git add src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java
git add src/test/java/com/kdb/it/common/system/service/RefreshTokenRotatorTest.java
git commit -m "refactor: 사용자 역할 조회 정책 단일화 (CQ-17)"
```

---

### Task 3: `Bcostm.UpdateCommand`를 builder record로 전환

**Files:**

- Create: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/entity/BcostmUpdateCommandTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java:13-17,160-226`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java:312-332`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java:754-778,1886-1915`

**Interfaces:**

- Produces: `Bcostm.UpdateCommand.builder()`와 `void Bcostm.update(Bcostm.UpdateCommand command)`
- Preserves: `dfrCleC`·`abusTc` 빈값의 `CodeDefaults.NOT_APPLICABLE` 보정과 기존 20개 필드 의미

- [ ] **Step 1: 20개 필드와 기본값을 고정하는 실패 테스트 작성**

```java
package com.kdb.it.domain.budget.cost.entity;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.code.CodeDefaults;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class BcostmUpdateCommandTest {

    @Test
    void update_명령의모든필드반영_필수코드빈값보정() {
        Bcostm target = Bcostm.builder().costBgNo("COST-1").bgSno(1).build();
        Bcostm.UpdateCommand command =
                Bcostm.UpdateCommand.builder()
                        .ioeC("IOE001")
                        .cttNm("계약명")
                        .cttOppNm("계약상대")
                        .costTotXpAmt(new BigDecimal("1300500.000"))
                        .dfrCleC(" ")
                        .fstDfrDt("20260731")
                        .curC("USD")
                        .xcr(new BigDecimal("1300.5000"))
                        .xcrBseDt("20260729")
                        .sectSysUtzYn("Y")
                        .indRsn("증액")
                        .cgprId("10001")
                        .costSvnDpmC("180")
                        .svnTemC("18001")
                        .bgUntAbusC("101")
                        .tmnYn("N")
                        .abusTc(null)
                        .bseYy("2026")
                        .cncdRfrNo("COST-2025-1")
                        .fcAmt(new BigDecimal("1000.000"))
                        .build();

        target.update(command);

        assertThat(target.getIoeC()).isEqualTo("IOE001");
        assertThat(target.getCttNm()).isEqualTo("계약명");
        assertThat(target.getCttOppNm()).isEqualTo("계약상대");
        assertThat(target.getCostTotXpAmt()).isEqualByComparingTo("1300500.000");
        assertThat(target.getDfrCleC()).isEqualTo(CodeDefaults.NOT_APPLICABLE);
        assertThat(target.getFstDfrDt()).isEqualTo("20260731");
        assertThat(target.getCurC()).isEqualTo("USD");
        assertThat(target.getXcr()).isEqualByComparingTo("1300.5000");
        assertThat(target.getXcrBseDt()).isEqualTo("20260729");
        assertThat(target.getSectSysUtzYn()).isEqualTo("Y");
        assertThat(target.getIndRsn()).isEqualTo("증액");
        assertThat(target.getCgprId()).isEqualTo("10001");
        assertThat(target.getCostSvnDpmC()).isEqualTo("180");
        assertThat(target.getSvnTemC()).isEqualTo("18001");
        assertThat(target.getBgUntAbusC()).isEqualTo("101");
        assertThat(target.getTmnYn()).isEqualTo("N");
        assertThat(target.getAbusTc()).isEqualTo(CodeDefaults.NOT_APPLICABLE);
        assertThat(target.getBseYy()).isEqualTo("2026");
        assertThat(target.getCncdRfrNo()).isEqualTo("COST-2025-1");
        assertThat(target.getFcAmt()).isEqualByComparingTo("1000.000");
    }

    @Test
    void update_null명령_대입전명시적예외() {
        Bcostm target = Bcostm.builder().costBgNo("COST-1").bgSno(1).build();

        assertThatNullPointerException()
                .isThrownBy(() -> target.update(null))
                .withMessage("command");
    }
}
```

- [ ] **Step 2: 테스트가 record 부재로 실패하는지 확인**

Run:

```powershell
.\gradlew.bat test --tests "com.kdb.it.domain.budget.cost.entity.BcostmUpdateCommandTest"
```

Expected: `Bcostm.UpdateCommand` 심볼을 찾을 수 없어 `compileTestJava`가 실패한다.

- [ ] **Step 3: builder record와 명령 기반 update를 추가하되 기존 오버로드를 임시 유지**

`Bcostm.java`에 `java.util.Objects`와 `lombok.Builder` import를 추가하고 기존 update JavaDoc의 필드 설명을 record JavaDoc으로 이동한다.

```java
/**
 * 전산업무비 변경값을 이름이 명시된 단일 명령으로 전달합니다.
 *
 * @param ioeC 비목코드
 * @param cttNm 계약명
 * @param cttOppNm 계약상대처명
 * @param costTotXpAmt 전산업무비예산금액
 * @param dfrCleC 지급주기코드
 * @param fstDfrDt 최초지급일자
 * @param curC 통화
 * @param xcr 환율
 * @param xcrBseDt 환율기준일자
 * @param sectSysUtzYn 정보보호여부
 * @param indRsn 증감사유
 * @param cgprId 담당자
 * @param costSvnDpmC 담당부서
 * @param svnTemC 담당팀
 * @param bgUntAbusC 사업코드
 * @param tmnYn 단말여부
 * @param abusTc 전산업무비구분
 * @param bseYy 예산연도
 * @param cncdRfrNo 관련전산업무비번호
 * @param fcAmt 외화금액
 */
@Builder
public record UpdateCommand(
        String ioeC,
        String cttNm,
        String cttOppNm,
        BigDecimal costTotXpAmt,
        String dfrCleC,
        String fstDfrDt,
        String curC,
        BigDecimal xcr,
        String xcrBseDt,
        String sectSysUtzYn,
        String indRsn,
        String cgprId,
        String costSvnDpmC,
        String svnTemC,
        String bgUntAbusC,
        String tmnYn,
        String abusTc,
        String bseYy,
        String cncdRfrNo,
        BigDecimal fcAmt) {}

/**
 * 명령에 담긴 전산업무비 변경값을 적용합니다.
 *
 * @param command 이름이 명시된 전산업무비 변경 명령
 * @throws NullPointerException command가 null인 경우
 */
public void update(UpdateCommand command) {
    Objects.requireNonNull(command, "command");
    this.ioeC = command.ioeC();
    this.cttNm = command.cttNm();
    this.cttOppNm = command.cttOppNm();
    this.costTotXpAmt = command.costTotXpAmt();
    this.dfrCleC = CodeDefaults.orNotApplicable(command.dfrCleC());
    this.fstDfrDt = command.fstDfrDt();
    this.curC = command.curC();
    this.xcr = command.xcr();
    this.xcrBseDt = command.xcrBseDt();
    this.sectSysUtzYn = command.sectSysUtzYn();
    this.indRsn = command.indRsn();
    this.cgprId = command.cgprId();
    this.costSvnDpmC = command.costSvnDpmC();
    this.svnTemC = command.svnTemC();
    this.bgUntAbusC = command.bgUntAbusC();
    this.tmnYn = command.tmnYn();
    this.abusTc = CodeDefaults.orNotApplicable(command.abusTc());
    this.bseYy = command.bseYy();
    this.cncdRfrNo = command.cncdRfrNo();
    this.fcAmt = command.fcAmt();
}
```

컴파일 가능한 중간 상태를 위해 기존 20개 인자 메서드는 아래처럼 builder에 이름으로 매핑해 `update(command)`로 위임한다. 이 오버로드는 Step 6에서 반드시 제거하며 커밋에 남기지 않는다.

```java
public void update(
        String ioeC,
        String cttNm,
        String cttOppNm,
        BigDecimal costTotXpAmt,
        String dfrCleC,
        String fstDfrDt,
        String curC,
        BigDecimal xcr,
        String xcrBseDt,
        String sectSysUtzYn,
        String indRsn,
        String cgprId,
        String costSvnDpmC,
        String svnTemC,
        String bgUntAbusC,
        String tmnYn,
        String abusTc,
        String bseYy,
        String cncdRfrNo,
        BigDecimal fcAmt) {
    update(
            UpdateCommand.builder()
                    .ioeC(ioeC)
                    .cttNm(cttNm)
                    .cttOppNm(cttOppNm)
                    .costTotXpAmt(costTotXpAmt)
                    .dfrCleC(dfrCleC)
                    .fstDfrDt(fstDfrDt)
                    .curC(curC)
                    .xcr(xcr)
                    .xcrBseDt(xcrBseDt)
                    .sectSysUtzYn(sectSysUtzYn)
                    .indRsn(indRsn)
                    .cgprId(cgprId)
                    .costSvnDpmC(costSvnDpmC)
                    .svnTemC(svnTemC)
                    .bgUntAbusC(bgUntAbusC)
                    .tmnYn(tmnYn)
                    .abusTc(abusTc)
                    .bseYy(bseYy)
                    .cncdRfrNo(cncdRfrNo)
                    .fcAmt(fcAmt)
                    .build());
}
```

- [ ] **Step 4: 엔티티 단위 테스트 통과 확인**

Run:

```powershell
.\gradlew.bat test --tests "com.kdb.it.domain.budget.cost.entity.BcostmUpdateCommandTest"
```

Expected: `BUILD SUCCESSFUL`, 20개 필드·두 기본값 보정·null 명령의 대입 전 실패 검증 통과.

- [ ] **Step 5: 유일한 운영 호출부를 이름 기반 builder로 전환**

`CostService.java`의 `target.update(...)`를 다음 구조로 교체한다.

```java
target.update(
        Bcostm.UpdateCommand.builder()
                .ioeC(request.getIoeC())
                .cttNm(request.getCttNm())
                .cttOppNm(request.getCttOppNm())
                .costTotXpAmt(request.getCostTotXpAmt())
                .dfrCleC(request.getDfrCleC())
                .fstDfrDt(DateFormatUtil.toYmd8(request.getFstDfrDt()))
                .curC(request.getCurC())
                .xcr(request.getXcr())
                .xcrBseDt(DateFormatUtil.toYmd8(request.getXcrBseDt()))
                .sectSysUtzYn(request.getSectSysUtzYn())
                .indRsn(request.getIndRsn())
                .cgprId(request.getCgprId())
                .costSvnDpmC(request.getCostSvnDpmC())
                .svnTemC(request.getSvnTemC())
                .bgUntAbusC(request.getBgUntAbusC())
                .tmnYn(request.getTmnYn())
                .abusTc(request.getAbusTc())
                .bseYy(request.getBseYy())
                .cncdRfrNo(request.getCncdRfrNo())
                .fcAmt(request.getFcAmt())
                .build());
```

`CostService.java:383`의 `Btermm existing.update(...)`는 변경하지 않는다.

- [ ] **Step 6: 서비스 테스트를 command captor로 전환하고 20인자 오버로드 제거**

`CostServiceTest`에 요청→command의 20개 필드 매핑을 record 동등성으로 한 번에 고정하는 테스트를 추가한다. 기존 테스트 클래스의 관리자 `SecurityContext` 설정 패턴을 사용하고 `finally`에서 반드시 clear한다.

```java
@Test
@DisplayName("updateCost: 보정된 요청의 모든 필드를 이름 기반 UpdateCommand로 전달한다")
void updateCost_보정된요청전체필드_UpdateCommand전달() {
    CustomUserDetails admin =
            new CustomUserDetails("10001", List.of(CustomUserDetails.ATH_ADMIN), "BBR001");
    org.springframework.security.core.Authentication auth =
            mock(org.springframework.security.core.Authentication.class);
    org.springframework.security.core.context.SecurityContext context =
            mock(org.springframework.security.core.context.SecurityContext.class);
    given(auth.getPrincipal()).willReturn(admin);
    given(context.getAuthentication()).willReturn(auth);
    org.springframework.security.core.context.SecurityContextHolder.setContext(context);

    try {
        Bcostm target = mock(Bcostm.class);
        given(target.getCostBgNo()).willReturn(IT_MNGC_NO);
        given(target.getBgSno()).willReturn(1);
        given(target.getLstYn()).willReturn("Y");
        given(target.getFstEnrUsid()).willReturn("10001");
        given(target.getCostSvnDpmC()).willReturn("BBR001");
        given(costRepository.findByCostBgNoAndDelYn(IT_MNGC_NO, "N"))
                .willReturn(List.of(target));
        given(btermmRepository.findByTermBgNoAndTermBgSnoAndDelYn(IT_MNGC_NO, 1, "N"))
                .willReturn(List.of());
        given(xcrLookupService.resolveXcr(eq("USD"), any(LocalDate.class)))
                .willReturn(new BigDecimal("1300.5000"));

        CostDto.UpdateRequest request =
                CostDto.UpdateRequest.builder()
                        .ioeC("IOE001")
                        .cttNm("계약명")
                        .cttOppNm("계약상대")
                        .costTotXpAmt(BigDecimal.ONE)
                        .dfrCleC("M")
                        .fstDfrDt("2026-07-31")
                        .curC("USD")
                        .xcr(BigDecimal.ONE)
                        .xcrBseDt("2026-07-29")
                        .sectSysUtzYn("Y")
                        .indRsn("증액")
                        .cgprId("10001")
                        .costSvnDpmC("180")
                        .svnTemC("18001")
                        .bgUntAbusC("101")
                        .tmnYn("N")
                        .abusTc("20")
                        .bseYy("2026")
                        .cncdRfrNo("COST-2025-1")
                        .fcAmt(new BigDecimal("1000.000"))
                        .terminals(List.of())
                        .build();

        costService.updateCost(IT_MNGC_NO, request);

        ArgumentCaptor<Bcostm.UpdateCommand> commandCaptor =
                ArgumentCaptor.forClass(Bcostm.UpdateCommand.class);
        verify(target).update(commandCaptor.capture());
        assertThat(commandCaptor.getValue())
                .isEqualTo(
                        Bcostm.UpdateCommand.builder()
                                .ioeC("IOE001")
                                .cttNm("계약명")
                                .cttOppNm("계약상대")
                                .costTotXpAmt(new BigDecimal("1300500.000"))
                                .dfrCleC("M")
                                .fstDfrDt("20260731")
                                .curC("USD")
                                .xcr(new BigDecimal("1300.5000"))
                                .xcrBseDt("20260729")
                                .sectSysUtzYn("Y")
                                .indRsn("증액")
                                .cgprId("10001")
                                .costSvnDpmC("180")
                                .svnTemC("18001")
                                .bgUntAbusC("101")
                                .tmnYn("N")
                                .abusTc("20")
                                .bseYy("2026")
                                .cncdRfrNo("COST-2025-1")
                                .fcAmt(new BigDecimal("1000.000"))
                                .build());
    } finally {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }
}
```

`CostServiceTest`의 `verify(first).update(...)`를 다음처럼 바꾼다.

```java
ArgumentCaptor<Bcostm.UpdateCommand> commandCaptor =
        ArgumentCaptor.forClass(Bcostm.UpdateCommand.class);
verify(first).update(commandCaptor.capture());
assertThat(commandCaptor.getValue().cttNm()).isEqualTo("수정 계약");
```

환율 회귀 테스트의 두 `BigDecimal` 인자 captor를 command captor 하나로 바꾼다.

```java
ArgumentCaptor<Bcostm.UpdateCommand> commandCaptor =
        ArgumentCaptor.forClass(Bcostm.UpdateCommand.class);
verify(target).update(commandCaptor.capture());
assertThat(commandCaptor.getValue().costTotXpAmt())
        .as("서버 재계산: 1000.000 × 1300.5000 = 1300500.0000")
        .isEqualByComparingTo("1300500.0000");
assertThat(commandCaptor.getValue().fcAmt()).isEqualByComparingTo("1000.000");
```

`CostServiceTest.java:832`의 `Btermm.update` 15인자 verify는 그대로 둔다.

모든 production·test 호출부가 새 API로 바뀐 뒤 `Bcostm`의 임시 20인자 오버로드를 삭제한다. 최종 클래스에는 `update(UpdateCommand)`만 남긴다.

- [ ] **Step 7: CQ-06 대상 테스트와 API 형태 확인**

Run:

```powershell
.\gradlew.bat test `
  --tests "com.kdb.it.domain.budget.cost.entity.BcostmUpdateCommandTest" `
  --tests "com.kdb.it.domain.budget.cost.service.CostServiceTest"
rg -n "public void update\\(" src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java
```

Expected:

- `BUILD SUCCESSFUL`
- `Bcostm`의 public `update` 선언은 `update(UpdateCommand command)` 한 개
- `Btermm.update` 테스트는 수정 없이 계속 통과

- [ ] **Step 8: builder record 전환 커밋**

```powershell
git add src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java
git add src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java
git add src/test/java/com/kdb/it/domain/budget/cost/entity/BcostmUpdateCommandTest.java
git add src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java
git commit -m "refactor: Bcostm 수정 명령을 builder record로 전환 (CQ-06)"
```

---

### Task 4: 전체 품질 게이트와 추적 문서 완료

**Files:**

- Modify after backend verification: `TASK.md`
- Modify after backend verification: `TASK_DONE.md`
- Move after completion: `docs/superpowers/plans/2026-07-29-clean-code-wave3-wave-a-backend-refactors.md` → `docs/superpowers/plans/done/2026-07-29-clean-code-wave3-wave-a-backend-refactors.md`

**Interfaces:**

- Consumes: Task 1~3의 두 backend 커밋
- Produces: CQ-06·CQ-17 완료 근거와 재현 가능한 최종 검증 기록

- [ ] **Step 1: 전체 backend 품질 게이트 실행**

Run:

```powershell
cd C:\it\it_backend
.\gradlew.bat check
```

Expected: `BUILD SUCCESSFUL`; Spotless, 전체 단위 테스트, JaCoCo 검증 통과.

- [ ] **Step 2: 정적 완료 조건 확인**

Run:

```powershell
rg -n "loadAthIds" src/main/java
rg -n "RoleRepository" `
  src/main/java/com/kdb/it/common/system/service/AuthService.java `
  src/main/java/com/kdb/it/common/system/service/RefreshTokenRotator.java
rg -n "public void update\\(" src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java
git status --short
git log -2 --oneline
```

Expected:

- 앞의 두 grep 결과 0건
- `Bcostm`에는 command 기반 update 한 개
- 의도한 production 파일 5개(신규 resolver 1개 포함), 기존 test 파일 3개, 신규 test 파일 2개 외 변경 없음
- CQ-17·CQ-06 커밋 두 개 확인

- [ ] **Step 3: 활성 과제를 완료 이관**

먼저 `Execution Preconditions`의 root targeted status 명령이 깨끗한지 다시 확인한다. 출력이 있으면 `TASK.md`나 `TASK_DONE.md`의 기존 사용자 변경을 덮거나 함께 stage하지 말고 문서 소유자에게 격리를 요청한다.

`C:\it\TASK.md`에서 CQ-06·CQ-17 행을 제거하고 `C:\it\TASK_DONE.md`에 다음 정보를 실제 backend 커밋과 검증 출력으로 기록한다.

- CQ-17: `UserRoleResolver` 경로, 전환한 다섯 진입점, resolver 3개 테스트, backend 커밋
- CQ-06: `@Builder Bcostm.UpdateCommand`, 유일한 production 호출부, 엔티티·서비스 테스트, backend 커밋
- 공통 검증: `./gradlew check BUILD SUCCESSFUL`

실제 backend 커밋은 다음 명령 결과를 사용한다.

```powershell
git -C C:\it\it_backend log -2 --format="%h %s"
```

- [ ] **Step 4: 완료 계획 이관과 root 문서 커밋**

```powershell
cd C:\it
$sourcePlan = 'C:\it\docs\superpowers\plans\2026-07-29-clean-code-wave3-wave-a-backend-refactors.md'
$donePlan = 'C:\it\docs\superpowers\plans\done\2026-07-29-clean-code-wave3-wave-a-backend-refactors.md'
if (-not (Test-Path -LiteralPath $sourcePlan)) { throw "완료 이관 원본 계획이 없습니다: $sourcePlan" }
if (Test-Path -LiteralPath $donePlan) { throw "완료 계획 경로가 이미 존재합니다: $donePlan" }
Move-Item -LiteralPath $sourcePlan -Destination $donePlan
git add -- TASK.md TASK_DONE.md
git add -- docs/superpowers/plans/done/2026-07-29-clean-code-wave3-wave-a-backend-refactors.md
git add -u -- docs/superpowers/plans/2026-07-29-clean-code-wave3-wave-a-backend-refactors.md
git diff --cached --name-only
git commit -m "docs: Clean Code Wave 3 Wave A 완료 이관"
```

`git diff --cached --name-only` 결과가 `TASK.md`, `TASK_DONE.md`, 계획의 이전·완료 경로 외 파일을 포함하면 commit하지 않고 예상하지 않은 파일을 unstage한다.

`versions.lock`은 이번 내부 리팩터링에서 갱신하지 않는다. 별도의 릴리스 조합을 기록할 때 모든 서브레포가 의도한 브랜치에 있는지 확인한 후 `scripts/update-versions-lock.ps1`을 실행한다.

---

## Test Coverage Diagram

```text
CODE PATHS                                                   USER/AUTH FLOWS
[+] UserRoleResolver.resolveAthIds                           [+] 비밀번호 로그인
  ├─ [★★★ PLANNED] 활성 역할 다건 + 순서 + 불변성             └─ [★★★ EXISTING+UPDATE] resolver 결과 → JWT/응답
  ├─ [★★★ PLANNED] 활성 역할 없음 → ATH_USER                 [+] 세션 복원
  └─ [★★★ PLANNED] Repository 실패 → 원본 예외                └─ [★★★ EXISTING+UPDATE] 최신 역할 → 화면 세션
                                                             [+] 개발 사용자 전환
[+] AuthService 역할 소비 4경로                               └─ [★★★ EXISTING+UPDATE] resolver 결과 → 신규 토큰
  ├─ [★★★ EXISTING+UPDATE] login                            [+] SSO 로그인
  ├─ [★★★ EXISTING+UPDATE] getSessionUser                    └─ [★★★ EXISTING+UPDATE] resolver 결과 → 신규 토큰
  ├─ [★★★ EXISTING+UPDATE] issueDevSwitchTokens             [+] Refresh
  └─ [★★★ EXISTING+UPDATE] issueSsoTokens                    └─ [★★★ EXISTING+UPDATE] 최신 역할 → 새 Access Token

[+] RefreshTokenRotator 역할 소비
  └─ [★★★ EXISTING+UPDATE] rotate 정상·불변식 위반·저장 실패

[+] Bcostm.update(UpdateCommand)
  ├─ [★★★ PLANNED] 20개 필드 매핑
  ├─ [★★★ PLANNED] null command → 대입 전 명시적 실패
  ├─ [★★★ PLANNED] dfrCleC blank → "0"
  ├─ [★★★ PLANNED] abusTc null → "0"
  ├─ [★★★ EXISTING+UPDATE] 계약명 전달
  └─ [★★★ EXISTING+UPDATE] costTotXpAmt·fcAmt 서버 계산값 전달

COVERAGE TARGET: 신규/변경 코드 경로 14/14
QUALITY TARGET: ★★★ 14 | ★★ 0 | ★ 0 | GAPS 0
E2E: 불필요 — REST/UI 계약을 바꾸지 않는 backend 내부 리팩터링
INTEGRATION TEST: 불필요 — 신규 쿼리·매핑·트랜잭션·DB 계약 없음
```

Legend: ★★★ 동작 + 경계 + 오류 경로 | ★★ 정상 경로 | ★ smoke

## Parallelization

| Step | Modules touched | Depends on |
| --- | --- | --- |
| CQ-17 resolver + 소비자 전환 | `common/iam/`, `common/system/` | — |
| CQ-06 builder record 전환 | `domain/budget/cost/` | — |
| 전체 검증·문서 이관 | backend 전체, root docs | 두 리팩터링 |

- Lane A: Task 1 → Task 2 (순차, resolver 인터페이스 선행)
- Lane B: Task 3 (Lane A와 독립)
- Lane C: Task 4 (Lane A와 Lane B 병합 후 실행)
- 실행 순서: A와 B를 별도 backend worktree에서 병렬 실행할 수 있다. 두 커밋을 병합한 뒤 C를 한 번 실행한다.
- 충돌 가능성: A와 B는 서로 다른 package module을 사용해 파일 충돌이 없다. 두 lane 모두 Gradle test 산출물을 쓰므로 같은 worktree에서 동시 실행하지 않는다.

## Baseline Evidence

- Cross-check backend commit: `74814d3`
- Baseline command:

```powershell
.\gradlew.bat test `
  --tests "com.kdb.it.common.system.service.AuthServiceTest" `
  --tests "com.kdb.it.common.system.service.RefreshTokenRotatorTest" `
  --tests "com.kdb.it.domain.budget.cost.service.CostServiceTest"
```

- Baseline result: `BUILD SUCCESSFUL` on 2026-07-29.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | Backend 내부 리팩터링으로 별도 제품 전략 리뷰 불필요 |
| Codex Review | outside voice | Independent 2nd opinion | 1 | ISSUES FIXED | 6 findings, 6/6 resolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | CLEAR (PLAN) | 10 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | 사용자 화면·REST 계약 변경 없음 |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | 별도 DX surface 없음 |

- **CROSS-MODEL:** 두 리뷰 모두 전체 DTO→command 매핑 검증을 요구했고, outside voice의 정확한 JWT 역할 전달·원자적 CQ-17 커밋·더티 root 문서 보호·Repository 반환 순서 표현·명시적 null 계약 지적을 모두 반영했다.
- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — root 계획 문서가 별도 커밋으로 추적되고 targeted status가 깨끗해진 뒤 구현 가능.
