# Phase 4 — 성능(Performance) Implementation Plan (T12–T16)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드 개선 로드맵 🟡 Phase 4(성능)의 5개 테마(T12 N+1 일괄조회 · T13 캐시 · T14 인덱스 · T15 시퀀스 CACHE · T16 프로젝션/캐시정합)를 **개별 커밋 가능한 태스크 단위**로 구현한다. 각 N+1 수정은 "리포지토리 1회 호출" 회귀 테스트(Mockito `verify`)를 먼저 작성(RED→GREEN)하고, 마이그레이션은 신규 `V20260622_*.sql`로만 추가한다(기존 스크립트 수정 금지).

**Architecture:** 기존 배치 패턴(`findBy...In` + `Map` 선구성)을 그대로 재사용한다. 캐시는 이미 구성된 `@EnableCaching` + `ConcurrentMapCacheManager`(`JpaAuditConfig`)에 캐시 이름만 추가한다(신규 의존성/TTL 인프라 없이 1단계 적용; TTL이 필요한 알림 카운트는 별도 메모로 한계 명시). 인덱스/시퀀스는 Flyway 마이그레이션으로 추가하며 `local-ext`/`local-int` 프로파일에서만 자동 적용된다.

**Tech Stack:** Java 25, Spring Boot 4.1.0, Spring Data JPA + QueryDSL 5.1.0, Oracle, JUnit 5 + AssertJ + Mockito. 빌드/테스트: `./gradlew`(루트 `it_backend`). Flyway 마이그레이션: `it_database/migrations/`.

**범위 메모(이미 처리된 항목):**
- `ProjectService.enrichProjectListBatch`(708–804) — **이미 배치 완료**(CAPPLA/CAPPLM/CDECIM/CORGNI/CUSERI 각 1회). 추가 조치 없음. T12에서 제외.
- `CostService.enrichCostListBatch`(540–688) — **이미 배치 완료**. 단, 단건 경로 `getCost`→`setApplicationInfo`/`setCodeNames`는 N+1이 남아있으나 단건이라 영향 낮음 → 범위 외.
- `ApproverRepository.findByDcdMngNoInOrderByDcrSqnSnoAsc(List<String>)` — **이미 존재**(repo line 56). ApplicationService N+1 수정 시 신규 메서드 추가 불필요, 호출부만 전환.
- `UserRepository.findByEnoIn(Collection<String>)` — **이미 존재**(repo line 76). 작성자명 배치에 그대로 사용.
- `BudgetWorkService.getSummary`의 요청금액 집계 — **이미 단일 집계 쿼리**(`BudgetWorkQueryRepository.findApprovedCostAmountByIoeC`)로 N+1 제거됨. 남은 N+1은 `getProjectSummary`의 `resolveProjectName`(사업별 1회 조회)과 `computeMplAdjustment`의 품목/사업 단건 루프 → T12-D에서 처리.

---

## File Structure

| 파일 | 책임 | 작업 |
| --- | --- | --- |
| `domain/budget/document/service/ServiceRequestDocService.java` | `getDocumentList` 작성자명 per-row `findById`→`findByEnoIn` 배치 | Modify |
| `test/.../domain/budget/document/service/ServiceRequestDocServiceTest.java` | 사용자 조회 1회 검증 | Create/Modify |
| `domain/budget/document/service/ReviewCommentService.java` | `getComments` 작성자명 per-row→배치 | Modify |
| `test/.../domain/budget/document/service/ReviewCommentServiceTest.java` | 사용자 조회 1회 검증 | Create/Modify |
| `common/approval/service/ApplicationService.java` | `getApplications` 결재자 N+1 제거(기존 In 메서드 사용), `getPendingCount`→COUNT | Modify |
| `domain/budget/project/repository/ProjectRepositoryCustom`/`Impl`, `cost/...CostRepositoryCustom`/`Impl` | `countBySearchCondition` COUNT 쿼리 추가 | Modify |
| `test/.../common/approval/service/ApplicationServiceTest.java` | 결재자 1회·COUNT 1회 검증 | Modify |
| `domain/budget/work/service/BudgetWorkService.java` | `getProjectSummary`/`computeMplAdjustment` 단건 루프→배치 | Modify |
| `config/JpaAuditConfig.java` | 캐시 이름 3종 추가 | Modify |
| `common/notification/service/NotificationService.java` | `unreadCount` `@Cacheable` + 쓰기 `@CacheEvict` | Modify |
| `common/system/tiptap/service/TiptapVariableService.java` | `getMetadata` `@Cacheable` + `resolve` 인트라요청 메모이즈 | Modify |
| `domain/menu/service/MenuQueryService.java` (+ 신규 `MenuAuthMapProvider`) | `athByMenu`→`@Cacheable` (self-invocation 회피) | Modify/Create |
| `domain/menu/service/AdminMenuService.java` | create/update/delete `@CacheEvict` | Modify |
| `it_database/migrations/V20260622_003__AddPhase4PerformanceIndexes.sql` | T14 인덱스 묶음 | Create |
| `it_database/migrations/V20260622_004__AlterSequencesCache20.sql` | T15 시퀀스 CACHE 20 | Create |
| `common/notification/repository/CinfmmRepositoryImpl.java` | `markAllReadByRmsEno` 영속성 컨텍스트 정합 메모/주석 | Modify(주석) |
| `domain/council/repository/CouncilRepository.java` | `updateProjectStatus` `clearAutomatically` | Modify |
| `domain/council/service/FeasibilityService.java` | bulk update 후 `flush` 명시 검토 | Modify(조건부) |

모든 main 경로 접두사: `it_backend/src/main/java/com/kdb/it/` (테스트는 `it_backend/src/test/java/com/kdb/it/`).

**마이그레이션 버전 선정:** 기존 마지막 = `V20260622_002`. 신규는 `V20260622_003`(인덱스), `V20260622_004`(시퀀스).

---

## Task 1: ServiceRequestDocService 작성자명 N+1 제거 (T12-A)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ServiceRequestDocService.java:70-82`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ServiceRequestDocServiceTest.java`

**배경:** `getDocumentList`가 문서마다 `cuserIRepository.findById(fstEnrUsid)`를 호출(line 76) → 문서 N건이면 N+1. `UserRepository.findByEnoIn`(line 76)이 이미 존재하므로 작성자 사번을 모아 1회 조회한다.

- [ ] **Step 1: 실패 테스트 작성 (RED)**

Create `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ServiceRequestDocServiceTest.java`:

```java
package com.kdb.it.domain.budget.document.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.common.iam.repository.UserRepository;
import com.kdb.it.domain.budget.document.dto.ServiceRequestDocDto;
import com.kdb.it.domain.budget.document.entity.Brdocm;
import com.kdb.it.domain.budget.document.repository.ServiceRequestDocRepository;
import java.util.Collection;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * ServiceRequestDocService N+1 회귀 테스트 — 목록 작성자명 배치 조회 검증.
 */
@ExtendWith(MockitoExtension.class)
class ServiceRequestDocServiceTest {

    @Mock private ServiceRequestDocRepository serviceRequestDocRepository;
    @Mock private UserRepository userRepository;
    @InjectMocks private ServiceRequestDocService service;

    private Brdocm doc(String docNo, String fstEnrUsid) {
        Brdocm b = org.mockito.Mockito.mock(Brdocm.class, org.mockito.Mockito.withSettings().lenient());
        given(b.getDocMngNo()).willReturn(docNo);
        given(b.getFstEnrUsid()).willReturn(fstEnrUsid);
        return b;
    }

    private CuserI user(String eno, String name) {
        CuserI u = org.mockito.Mockito.mock(CuserI.class);
        given(u.getEno()).willReturn(eno);
        given(u.getUsrNm()).willReturn(name);
        return u;
    }

    @Test
    @DisplayName("getDocumentList: 작성자명은 findByEnoIn 1회로 배치 조회하고 findById는 호출하지 않는다")
    void getDocumentList_batchesAuthorNames() {
        given(serviceRequestDocRepository.findLatestVersionsAll())
                .willReturn(List.of(doc("DOC-1", "E001"), doc("DOC-2", "E002"), doc("DOC-3", "E001")));
        given(userRepository.findByEnoIn(org.mockito.ArgumentMatchers.<Collection<String>>any()))
                .willReturn(List.of(user("E001", "홍길동"), user("E002", "김철수")));

        List<ServiceRequestDocDto.Response> result = service.getDocumentList();

        assertThat(result).hasSize(3);
        assertThat(result.get(0).getFstEnrUsNm()).isEqualTo("홍길동");
        assertThat(result.get(1).getFstEnrUsNm()).isEqualTo("김철수");
        verify(userRepository, times(1)).findByEnoIn(org.mockito.ArgumentMatchers.<Collection<String>>any());
        verify(userRepository, never()).findById(org.mockito.ArgumentMatchers.anyString());
    }
}
```

> 주의: `ServiceRequestDocDto.Response.fromEntity(Brdocm)`가 호출되므로 `Brdocm` 모킹은 `fromEntity`가 참조하는 getter에 대해 `lenient()` 스텁이 필요할 수 있다(위에서 `lenient` 적용). 실행 후 NPE가 나는 필드가 있으면 `given(...)`을 추가한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.document.service.ServiceRequestDocServiceTest"`
Expected: FAIL — 현재 코드는 `findById`를 호출하고 `findByEnoIn`은 호출하지 않음.

- [ ] **Step 3: 구현 교체 (GREEN)**

`ServiceRequestDocService.java`의 `getDocumentList`(70–82)를 교체. 교체 전:

```java
    public List<ServiceRequestDocDto.Response> getDocumentList() {
        return serviceRequestDocRepository.findLatestVersionsAll().stream()
                .map(entity -> {
                    ServiceRequestDocDto.Response response = ServiceRequestDocDto.Response.fromEntity(entity);
                    // 최초생성자 사번 → 사용자명 매핑
                    if (response.getFstEnrUsid() != null && !response.getFstEnrUsid().isEmpty()) {
                        cuserIRepository.findById(response.getFstEnrUsid())
                                .ifPresent(user -> response.setFstEnrUsNm(user.getUsrNm()));
                    }
                    return response;
                })
                .collect(Collectors.toList());
    }
```

교체 후:

```java
    public List<ServiceRequestDocDto.Response> getDocumentList() {
        List<ServiceRequestDocDto.Response> responses = serviceRequestDocRepository.findLatestVersionsAll().stream()
                .map(ServiceRequestDocDto.Response::fromEntity)
                .collect(Collectors.toList());

        // 작성자명 배치 조회 (N+1 제거): 사번 집합 → findByEnoIn 1회 → eno→이름 Map
        java.util.Set<String> enos = responses.stream()
                .map(ServiceRequestDocDto.Response::getFstEnrUsid)
                .filter(eno -> eno != null && !eno.isEmpty())
                .collect(Collectors.toSet());
        if (!enos.isEmpty()) {
            java.util.Map<String, String> nameByEno = cuserIRepository.findByEnoIn(enos).stream()
                    .collect(Collectors.toMap(
                            com.kdb.it.common.iam.entity.CuserI::getEno,
                            com.kdb.it.common.iam.entity.CuserI::getUsrNm,
                            (a, b) -> a));
            responses.forEach(r -> {
                if (r.getFstEnrUsid() != null) {
                    r.setFstEnrUsNm(nameByEno.get(r.getFstEnrUsid()));
                }
            });
        }
        return responses;
    }
```

(`Collectors`, `List`는 이미 import됨. `Set`/`Map`은 FQN으로 사용했으므로 추가 import 불필요. 가독성을 위해 import 추가도 무방.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.document.service.ServiceRequestDocServiceTest"`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget/document/service/ServiceRequestDocService.java src/test/java/com/kdb/it/domain/budget/document/service/ServiceRequestDocServiceTest.java && git commit -m "perf: batch author-name lookup in ServiceRequestDocService.getDocumentList"
```

---

## Task 2: ReviewCommentService 작성자명 N+1 제거 (T12-B)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ReviewCommentService.java:40-48,96-101`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ReviewCommentServiceTest.java`

**배경:** `getComments`가 댓글마다 `resolveAuthorName`→`userRepository.findById(eno)`(line 98) 호출 → N+1. `findByEnoIn`으로 배치한다. `addComment`(단건)는 그대로 단건 조회 유지(`resolveAuthorName` 헬퍼 보존).

- [ ] **Step 1: 실패 테스트 작성 (RED)**

Create `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ReviewCommentServiceTest.java`:

```java
package com.kdb.it.domain.budget.document.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.common.iam.repository.UserRepository;
import com.kdb.it.domain.budget.document.dto.ReviewCommentDto;
import com.kdb.it.domain.budget.document.entity.Brivgm;
import com.kdb.it.domain.budget.document.repository.BrivgmRepository;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * ReviewCommentService N+1 회귀 테스트 — 검토의견 작성자명 배치 조회 검증.
 */
@ExtendWith(MockitoExtension.class)
class ReviewCommentServiceTest {

    @Mock private BrivgmRepository brivgmRepository;
    @Mock private UserRepository userRepository;
    @InjectMocks private ReviewCommentService service;

    private Brivgm comment(String eno) {
        Brivgm e = org.mockito.Mockito.mock(Brivgm.class,
                org.mockito.Mockito.withSettings().lenient().defaultAnswer(org.mockito.Mockito.RETURNS_DEFAULTS));
        given(e.getFstEnrUsid()).willReturn(eno);
        return e;
    }

    @Test
    @DisplayName("getComments: 작성자명은 findByEnoIn 1회 배치 조회하고 findById는 호출하지 않는다")
    void getComments_batchesAuthorNames() {
        given(brivgmRepository.findByDocMngNoAndDocVrsSnoAndDelYnOrderByFstEnrDtmAsc(
                org.mockito.ArgumentMatchers.eq("DOC-1"),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq("N")))
                .willReturn(List.of(comment("E001"), comment("E002"), comment("E001")));
        CuserI u1 = org.mockito.Mockito.mock(CuserI.class);
        given(u1.getEno()).willReturn("E001");
        given(u1.getUsrNm()).willReturn("홍길동");
        CuserI u2 = org.mockito.Mockito.mock(CuserI.class);
        given(u2.getEno()).willReturn("E002");
        given(u2.getUsrNm()).willReturn("김철수");
        given(userRepository.findByEnoIn(org.mockito.ArgumentMatchers.<Collection<String>>any()))
                .willReturn(List.of(u1, u2));

        List<ReviewCommentDto.Response> result = service.getComments("DOC-1", new BigDecimal("0.01"));

        assertThat(result).hasSize(3);
        verify(userRepository, times(1)).findByEnoIn(org.mockito.ArgumentMatchers.<Collection<String>>any());
        verify(userRepository, never()).findById(org.mockito.ArgumentMatchers.anyString());
    }
}
```

> `ReviewCommentDto.Response(Brivgm, String)` 생성자가 참조하는 Brivgm getter는 lenient 기본값으로 처리된다. 실행 후 NPE가 나는 필드가 있으면 명시 스텁을 추가한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.document.service.ReviewCommentServiceTest"`
Expected: FAIL — 현재 `findById` per-row 호출.

- [ ] **Step 3: 구현 교체 (GREEN)**

`ReviewCommentService.java`의 `getComments`(40–48)를 교체. 교체 전:

```java
    @Transactional(readOnly = true)
    public List<ReviewCommentDto.Response> getComments(String docMngNo, BigDecimal docVrsSno) {
        // 화면 소수 버전 → 저장 정수 버전(× 100)으로 변환하여 조회 (Brdocm 버전 키와 동일 규약)
        return brivgmRepository
                .findByDocMngNoAndDocVrsSnoAndDelYnOrderByFstEnrDtmAsc(docMngNo, DocVersionCodec.toStored(docVrsSno), "N")
                .stream()
                .map(e -> new ReviewCommentDto.Response(e, resolveAuthorName(e.getFstEnrUsid())))
                .collect(Collectors.toList());
    }
```

교체 후:

```java
    @Transactional(readOnly = true)
    public List<ReviewCommentDto.Response> getComments(String docMngNo, BigDecimal docVrsSno) {
        // 화면 소수 버전 → 저장 정수 버전(× 100)으로 변환하여 조회 (Brdocm 버전 키와 동일 규약)
        var comments = brivgmRepository
                .findByDocMngNoAndDocVrsSnoAndDelYnOrderByFstEnrDtmAsc(docMngNo, DocVersionCodec.toStored(docVrsSno), "N");

        // 작성자명 배치 조회 (N+1 제거): 사번 집합 → findByEnoIn 1회 → eno→이름 Map
        java.util.Set<String> enos = comments.stream()
                .map(com.kdb.it.domain.budget.document.entity.Brivgm::getFstEnrUsid)
                .filter(eno -> eno != null && !eno.isEmpty())
                .collect(Collectors.toSet());
        java.util.Map<String, String> nameByEno = enos.isEmpty() ? java.util.Map.of()
                : userRepository.findByEnoIn(enos).stream()
                        .collect(Collectors.toMap(
                                com.kdb.it.common.iam.entity.CuserI::getEno,
                                com.kdb.it.common.iam.entity.CuserI::getUsrNm,
                                (a, b) -> a));

        return comments.stream()
                .map(e -> new ReviewCommentDto.Response(e,
                        e.getFstEnrUsid() == null ? "" : nameByEno.getOrDefault(e.getFstEnrUsid(), e.getFstEnrUsid())))
                .collect(Collectors.toList());
    }
```

`resolveAuthorName`(96–101) 헬퍼는 `addComment` 단건 경로가 계속 사용하므로 **유지**한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.document.service.ReviewCommentServiceTest"`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget/document/service/ReviewCommentService.java src/test/java/com/kdb/it/domain/budget/document/service/ReviewCommentServiceTest.java && git commit -m "perf: batch author-name lookup in ReviewCommentService.getComments"
```

---

## Task 3: ApplicationService 결재자 N+1 + getPendingCount COUNT 전환 (T12-C)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java:469-477,587-606`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepositoryCustom.java`, `ProjectRepositoryImpl.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepositoryCustom.java`, `CostRepositoryImpl.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java`

**배경 A — 결재자 N+1:** `getApplications`(469–476)가 신청서마다 `approverRepository.findByDcdMngNoOrderByDcrSqnSnoAsc(apfMngNo)` 호출 → N+1. **배치 메서드 `findByDcdMngNoInOrderByDcrSqnSnoAsc(List<String>)`가 이미 존재**(ApproverRepository line 56)하므로 호출부만 전환한다.

**배경 B — getPendingCount:** `searchByCondition(...).size()`(593,599)는 전체 엔티티를 메모리에 적재 후 카운트 → 불필요한 적재. QueryDSL `select(count())`로 COUNT 쿼리화한다(`countBySearchCondition`).

- [ ] **Step 1: 실패 테스트 작성 (RED)**

`ApplicationServiceTest.java`에 두 테스트 추가(파일이 없으면 생성, 있으면 메서드 추가). 모킹 필드: `applicationRepository`, `approverRepository`, `projectRepository`, `costRepository`.

```java
    @Test
    @DisplayName("getApplications: 결재자 목록은 findByDcdMngNoIn 1회로 배치 조회한다")
    void getApplications_batchesApprovers() {
        Capplm a1 = org.mockito.Mockito.mock(Capplm.class);
        Capplm a2 = org.mockito.Mockito.mock(Capplm.class);
        given(a1.getApfMngNo()).willReturn("APF-1");
        given(a2.getApfMngNo()).willReturn("APF-2");
        given(applicationRepository.findAll()).willReturn(java.util.List.of(a1, a2));
        given(approverRepository.findByDcdMngNoInOrderByDcrSqnSnoAsc(org.mockito.ArgumentMatchers.anyList()))
                .willReturn(java.util.List.of());

        applicationService.getApplications();

        verify(approverRepository, times(1))
                .findByDcdMngNoInOrderByDcrSqnSnoAsc(org.mockito.ArgumentMatchers.anyList());
        verify(approverRepository, never())
                .findByDcdMngNoOrderByDcrSqnSnoAsc(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    @DisplayName("getPendingCount: 전체 적재 대신 countBySearchCondition COUNT 쿼리를 사용한다")
    void getPendingCount_usesCountQuery() {
        given(projectRepository.countBySearchCondition(org.mockito.ArgumentMatchers.any())).willReturn(3L);
        given(costRepository.countBySearchCondition(org.mockito.ArgumentMatchers.any())).willReturn(2L);

        var res = applicationService.getPendingCount("2026");

        assertThat(res.getTotalCount()).isEqualTo(5L);
        verify(projectRepository, never()).searchByCondition(org.mockito.ArgumentMatchers.any());
        verify(costRepository, never()).searchByCondition(org.mockito.ArgumentMatchers.any());
    }
```

> `PendingCountResponse.getTotalCount()` 반환 타입이 `long`인지 확인(서비스가 `projectCount + costCount`로 long 합산). 빌더 필드 타입에 맞춰 단언값 조정.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.approval.service.ApplicationServiceTest"`
Expected: 컴파일 실패(`countBySearchCondition` 없음) 또는 검증 실패.

- [ ] **Step 3: 리포지토리에 COUNT 메서드 추가**

`ProjectRepositoryCustom.java`에 시그니처 추가:

```java
    /** 검색 조건에 해당하는 건수 (COUNT 쿼리, 전체 적재 회피) */
    long countBySearchCondition(com.kdb.it.domain.budget.project.dto.ProjectDto.SearchCondition condition);
```

`ProjectRepositoryImpl.java`: 기존 `searchByCondition`이 조립하는 조건(동일 `BooleanBuilder`)을 재사용해 COUNT만 수행. 기존 `searchByCondition`의 조건 조립 블록을 `private BooleanBuilder buildConditionPredicate(SearchCondition)`로 추출한 뒤 두 메서드가 공유한다.

```java
    @Override
    public long countBySearchCondition(ProjectDto.SearchCondition condition) {
        BooleanBuilder builder = buildConditionPredicate(condition); // 기존 조건 조립 추출
        Long cnt = queryFactory
                .select(qBprojm.count())
                .from(qBprojm)
                .where(builder)
                .fetchOne();
        return cnt == null ? 0L : cnt;
    }
```

> **주의(실행자):** `searchByCondition`에 `apfSts="none"` 같은 CAPPLA EXISTS/NOT EXISTS 서브쿼리 조건이 있으면 `buildConditionPredicate`에 그대로 포함시켜 COUNT 결과가 `searchByCondition(...).size()`와 **정확히 일치**해야 한다. 추출 시 조건 누락 금지. `CostRepositoryCustom`/`CostRepositoryImpl`도 동일 패턴으로 `countBySearchCondition(CostDto.SearchCondition)` 추가. (실제 QueryDSL `Q*` 변수명/factory 필드명은 기존 Impl에서 확인.)

- [ ] **Step 4: ApplicationService 호출부 전환**

`getApplications`(469–477) 교체. 교체 전:

```java
    public List<ApplicationDto.Response> getApplications() {
        return applicationRepository.findAll().stream()
                .map(capplm -> {
                    // 각 신청서의 결재자 목록을 별도 조회하여 DTO에 포함
                    List<Cdecim> approvers = approverRepository.findByDcdMngNoOrderByDcrSqnSnoAsc(capplm.getApfMngNo());
                    return ApplicationDto.Response.fromEntity(capplm, approvers);
                })
                .toList();
    }
```

교체 후:

```java
    public List<ApplicationDto.Response> getApplications() {
        List<Capplm> capplms = applicationRepository.findAll();
        List<String> apfMngNos = capplms.stream().map(Capplm::getApfMngNo).toList();

        // 결재선 배치 조회 (N+1 제거): 신청번호별 결재자 목록 Map 선구성
        java.util.Map<String, List<Cdecim>> approversByApf =
                approverRepository.findByDcdMngNoInOrderByDcrSqnSnoAsc(apfMngNos).stream()
                        .collect(java.util.stream.Collectors.groupingBy(Cdecim::getDcdMngNo));

        return capplms.stream()
                .map(capplm -> ApplicationDto.Response.fromEntity(
                        capplm, approversByApf.getOrDefault(capplm.getApfMngNo(), List.of())))
                .toList();
    }
```

> `Cdecim::getDcdMngNo`가 신청번호(=`apfMngNo`) getter인지 확인(엔티티 field `dcdMngNo`, 물리컬럼 `APF_DCM_NO`; `Capplm.getApfMngNo()`와 값 동일). 일치 확인 후 사용.

`getPendingCount`(587–606)에서 `.searchByCondition(...).size()` 두 줄을 COUNT 호출로 교체:

```java
        long projectCount = projectRepository.countBySearchCondition(projectCondition);
        ...
        long costCount = costRepository.countBySearchCondition(costCondition);
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.approval.service.ApplicationServiceTest"`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/approval/service/ApplicationService.java src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository*.java src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepository*.java src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java && git commit -m "perf: batch approver lookup and COUNT-based pending count in ApplicationService"
```

---

## Task 4: BudgetWorkService getProjectSummary 단건 루프 배치 (T12-D)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java:804-821,866-917,627-651`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java`

**배경:** `getProjectSummary`는 (1) 그룹키 결정 시 `itemToPrjCache.computeIfAbsent(...) → projectItemRepository.findByGclMngNoAndDelYn(gclMngNo,"N")`(818–820)을 품목 PK별로 호출하고, (2) 응답 구성 시 그룹별로 `resolveProjectName`(870)→`projectRepository.findByAbusMngNoAndDelYn`/`costRepository.findByCostBgNoAndDelYn`(906,910)을 1회씩 호출한다. 또 `computeMplAdjustment`(639–651)는 `byGcl` 키별 `findByGclMngNoAndDelYn`, 사업별 `findByAbusMngNoAndDelYn`을 단건 루프로 호출한다. 그룹 수가 많아질수록 N+1.

**조치 전략(보수적, 동작 동치 유지):**
- 품목 PK 집합 → `projectItemRepository.findByGclMngNoInAndDelYn(Set, "N")`(신규) 1회 → `gclMngNo → Bitemm`(첫 행) Map.
- 사업관리번호 집합 → `projectRepository.findByAbusMngNoInAndDelYn(Set, "N")`(신규) 1회 → `abusMngNo → Bprojm`(첫 행) Map.
- 전산업무비(BCOSTM) 이름 → 그룹키 집합 → `costRepository.findByCostBgNoInAndDelYn(Set,"N")`(신규) 1회 → `costBgNo → cttNm`(첫 행) Map.

> 신규 In-메서드는 Spring Data 파생 쿼리(`findBy...In...`)로 추가 가능하며 기존 단건 메서드와 **정확히 같은 필터(DEL_YN)**를 유지한다. 기존 코드가 `get(0)`/`findFirst()`만 사용하므로 첫 행 채택 규칙을 그대로 보존한다.

- [ ] **Step 1: 실패 테스트 작성 (RED)**

`BudgetWorkServiceTest.java`에 회귀 테스트 추가 — `getProjectSummary` 호출 시 단건 finder가 그룹 수만큼 호출되지 않고 In-메서드가 1회만 호출되는지 검증. **기존 `getSummary`/`getProjectSummary` 테스트의 픽스처 빌더를 재사용**하여 서로 다른 사업 2건의 BITEMM 편성행을 구성한다.

```java
    @Test
    @DisplayName("getProjectSummary: 품목 조회를 In-쿼리 1회로 배치하고 단건 finder를 호출하지 않는다")
    void getProjectSummary_batchesLookups() {
        // Arrange: 기존 테스트 픽스처 헬퍼로 2개 사업 BITEMM 편성행 + 코드 스텁 구성
        //   given(bbugtmRepository.findByBseYyAndDelYn("2026","N")).willReturn(...);
        //   given(budgetWorkQueryRepository.findApprovedSourcePks("2026")).willReturn(Set.of(...));
        //   given(codeRepository.findByCIdWithValidDate(...)).willReturn(...);  // findCodes 스텁
        given(projectItemRepository.findByGclMngNoInAndDelYn(
                org.mockito.ArgumentMatchers.anyCollection(), org.mockito.ArgumentMatchers.eq("N")))
                .willReturn(/* Bitemm 목록 */ java.util.List.of());

        budgetWorkService.getProjectSummary("2026");

        verify(projectItemRepository, times(1)).findByGclMngNoInAndDelYn(
                org.mockito.ArgumentMatchers.anyCollection(), org.mockito.ArgumentMatchers.eq("N"));
        verify(projectItemRepository, never()).findByGclMngNoAndDelYn(
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
    }
```

> 픽스처가 무겁다(BBUGTM/Bitemm/Bprojm/Ccodem 다수 스텁). 실행자는 기존 `BudgetWorkServiceTest`의 빌더 헬퍼를 그대로 차용해 최소 2개 사업만 구성한다(플레이스홀더 금지 — 실제 빌더 사용).

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest"`
Expected: 컴파일 실패(`findByGclMngNoInAndDelYn` 없음).

- [ ] **Step 3: 리포지토리 In-메서드 추가**

`ProjectItemRepository`(파생 쿼리):

```java
    /** 품목관리번호 집합 일괄 조회 (N+1 제거) */
    java.util.List<Bitemm> findByGclMngNoInAndDelYn(java.util.Collection<String> gclMngNos, String delYn);
```

`CostRepository`(파생 쿼리):

```java
    /** 전산업무비번호 집합 일괄 조회 (N+1 제거) — 이름 매핑용 */
    java.util.List<Bcostm> findByCostBgNoInAndDelYn(java.util.Collection<String> costBgNos, String delYn);
```

`ProjectRepository`(파생 쿼리; 기존 `findAllByAbusMngNoInAndDelYnAndLstYn`(line 99)는 LST_YN 조건이 있어 본 용도와 다르면 신규 추가):

```java
    /** 사업관리번호 집합 일괄 조회 (N+1 제거) — 사업명 매핑용 */
    java.util.List<Bprojm> findByAbusMngNoInAndDelYn(java.util.Collection<String> abusMngNos, String delYn);
```

- [ ] **Step 4: getProjectSummary / computeMplAdjustment 배치 치환 (GREEN)**

`getProjectSummary`의 그룹키 결정 루프(810–859) 진입 전에 선조회 단계를 추가:

```java
        // 선조회: BITEMM 편성행의 품목 PK 집합 → gclMngNo→prjMngNo Map (N+1 제거)
        java.util.Set<String> gclPks = budgets.stream()
                .filter(b -> "BITEMM".equals(b.getFntTbNm()) && b.getPkColNm() != null)
                .map(Bbugtm::getPkColNm)
                .collect(java.util.stream.Collectors.toSet());
        Map<String, String> gclToPrj = new LinkedHashMap<>();
        if (!gclPks.isEmpty()) {
            for (Bitemm it : projectItemRepository.findByGclMngNoInAndDelYn(gclPks, "N")) {
                gclToPrj.putIfAbsent(it.getGclMngNo(), it.getAbusMngNo());
            }
        }
```

기존 `itemToPrjCache.computeIfAbsent(...)` 블록(818–821)을 `gclToPrj.getOrDefault(b.getPkColNm(), b.getPkColNm())` 참조로 교체(`itemToPrjCache` 변수 제거).

응답 구성 루프의 `resolveProjectName(orcTb, orcPkVl)`(870)은 사업명/계약명 Map 선조회로 치환. 루프 진입 전:

```java
        // 사업명/계약명 배치 선조회
        java.util.Set<String> prjNos = orcTbMap.entrySet().stream()
                .filter(e -> "BPROJM".equals(e.getValue())).map(Map.Entry::getKey)
                .collect(java.util.stream.Collectors.toSet());
        java.util.Set<String> costNos = orcTbMap.entrySet().stream()
                .filter(e -> "BCOSTM".equals(e.getValue())).map(Map.Entry::getKey)
                .collect(java.util.stream.Collectors.toSet());
        Map<String, String> prjNameByNo = prjNos.isEmpty() ? Map.of()
                : projectRepository.findByAbusMngNoInAndDelYn(prjNos, "N").stream()
                        .collect(java.util.stream.Collectors.toMap(Bprojm::getAbusMngNo, Bprojm::getAbusNm, (a, b) -> a));
        Map<String, String> costNameByNo = costNos.isEmpty() ? Map.of()
                : costRepository.findByCostBgNoInAndDelYn(costNos, "N").stream()
                        .collect(java.util.stream.Collectors.toMap(Bcostm::getCostBgNo, Bcostm::getCttNm, (a, b) -> a));
```

이후 `String name = resolveProjectName(orcTb, orcPkVl);`를 다음으로 교체:

```java
            String name = "BPROJM".equals(orcTb) ? prjNameByNo.getOrDefault(orcPkVl, orcPkVl)
                    : "BCOSTM".equals(orcTb) ? costNameByNo.getOrDefault(orcPkVl, orcPkVl)
                    : orcPkVl;
```

`computeMplAdjustment`(639–651)의 `byGcl.keySet()` 단건 루프와 사업별 단건 루프도 동일하게 `findByGclMngNoInAndDelYn`/`findByAbusMngNoInAndDelYn` 선조회 Map으로 치환한다(동일 첫-행 채택 규칙 유지).

`resolveProjectName` private 메서드는 다른 호출처가 없으면 제거한다(미사용 경고 회피).

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest"`
Expected: PASS. **추가로 기존 합계 검증 테스트가 그대로 통과해야 한다(동작 동치 확인).**

- [ ] **Step 6: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java src/main/java/com/kdb/it/domain/budget/project/repository/ProjectItemRepository.java src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepository.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java && git commit -m "perf: batch project/item/cost lookups in BudgetWorkService.getProjectSummary"
```

---

## Task 5: 캐시 이름 등록 + Notification 미읽음 카운트 캐시 (T13-A)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/config/JpaAuditConfig.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/service/NotificationService.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/notification/service/NotificationServiceCacheTest.java`(신규, 컨텍스트 기반)

**배경:** 캐시는 이미 `@EnableCaching` + `ConcurrentMapCacheManager("codesByType","codesByCid","budgetPeriod")`로 구성됨(`JpaAuditConfig`). `unreadCount(currentEno)`는 AppHeader 배지에서 고빈도 호출되나 per-user 카운트라 캐시 적중률이 높다. 쓰기 경로(`send`/`markRead`/`markAllRead`/`softDelete`)에서 해당 사용자 키를 evict한다.

> **TTL 한계 메모(중요):** `ConcurrentMapCacheManager`는 TTL을 지원하지 않는다. 본 태스크는 **쓰기 시 즉시 evict**로 정합을 보장하되, 스펙의 "TTL 60s"는 다중 인스턴스/외부 변경 안전망이다. 운영에서 TTL이 필요하면 후속 태스크로 `spring-boot-starter-cache` + Caffeine 도입(범위 외, TASK.md 등록 권장). 본 1단계는 단일 인스턴스 가정에서 evict-on-write로 충분.

- [ ] **Step 1: 실패 테스트 작성 (RED)**

`@Cacheable`은 Spring 프록시가 있어야 동작하므로 컨텍스트 기반 테스트로 작성한다. Create `it_backend/src/test/java/com/kdb/it/common/notification/service/NotificationServiceCacheTest.java`:

```java
package com.kdb.it.common.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.kdb.it.common.notification.dispatcher.NotificationDispatcher;
import com.kdb.it.common.notification.repository.CinfmmRepository;
import com.kdb.it.config.JpaAuditConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

/**
 * 알림 미읽음 카운트 캐시 동작 검증 — @Cacheable 적용 시 repository 1회만 호출.
 */
@SpringJUnitConfig
@ContextConfiguration(classes = {JpaAuditConfig.class, NotificationService.class})
class NotificationServiceCacheTest {

    @Autowired private NotificationService service;
    @MockBean private CinfmmRepository cinfmmRepository;
    @MockBean private NotificationDispatcher dispatcher;

    @Test
    @DisplayName("unreadCount 캐시: 동일 사용자 연속 조회 시 repository는 1회만 호출된다")
    void unreadCount_cached() {
        given(cinfmmRepository.countUnread("E001")).willReturn(3L);

        assertThat(service.unreadCount("E001")).isEqualTo(3L);
        assertThat(service.unreadCount("E001")).isEqualTo(3L);

        verify(cinfmmRepository, times(1)).countUnread("E001");
    }
}
```

> `JpaAuditConfig`는 `@EnableJpaAuditing`도 선언하므로 컨텍스트 로드 시 JPA 인프라를 요구할 수 있다. 로드 실패 시, 캐시 설정만 분리한 경량 `@Configuration`(예: `CacheConfig`)으로 `@EnableCaching` + `cacheManager`를 옮기고 본 테스트는 `CacheConfig`만 import하도록 조정한다(아래 Step 3에서 분리 옵션 제시).

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.notification.service.NotificationServiceCacheTest"`
Expected: FAIL — 캐시 미적용으로 repository 2회 호출.

- [ ] **Step 3: 캐시 이름 등록**

`JpaAuditConfig.java`의 `cacheManager()` 빈에 캐시 이름 추가:

```java
    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager(
                "codesByType", "codesByCid", "budgetPeriod",
                "notificationUnreadCount", "tiptapMetadata", "menuAuthMap");
    }
```

> (선택) 테스트 컨텍스트 경량화를 위해 `@EnableCaching` + `cacheManager`를 별도 `config/CacheConfig.java`로 분리하면 캐시 단위 테스트가 JPA 인프라 없이 로드된다. 분리 시 `JpaAuditConfig`의 `@EnableCaching`/`cacheManager`를 제거하고 `CacheConfig`로 이동, 기존 `codesByCid`/`budgetPeriod` 캐시 동작은 그대로 유지됨을 `CodeService` 테스트로 회귀 확인.

- [ ] **Step 4: NotificationService 애너테이션 적용**

import 추가:

```java
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
```

`unreadCount`:

```java
    @Cacheable(value = "notificationUnreadCount", key = "#currentEno", unless = "#result == 0")
    public long unreadCount(String currentEno) {
        return cinfmmRepository.countUnread(currentEno);
    }
```

쓰기 경로 evict:
- `markRead(String infmMsgNo, String currentEno)` → `@CacheEvict(value = "notificationUnreadCount", key = "#currentEno")`
- `markAllRead(String currentEno)` → `@CacheEvict(value = "notificationUnreadCount", key = "#currentEno")`
- `softDelete(String infmMsgNo, String currentEno)` → `@CacheEvict(value = "notificationUnreadCount", key = "#currentEno")`
- `send(NotificationEvent event)` → `@CacheEvict(value = "notificationUnreadCount", key = "#event.recipientEno()", condition = "#event.recipientEno() != null")`

> `send`는 `@Transactional(REQUIRES_NEW)`와 함께 외부 이벤트 리스너에서 호출되므로 프록시 경유가 보장된다. evict 키 표현식 `#event.recipientEno()`가 record 접근자명과 일치하는지 확인.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.notification.service.NotificationServiceCacheTest"`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/config/JpaAuditConfig.java src/main/java/com/kdb/it/common/notification/service/NotificationService.java src/test/java/com/kdb/it/common/notification/service/NotificationServiceCacheTest.java && git commit -m "perf: cache notification unread-count with evict-on-write"
```

---

## Task 6: Tiptap 메타데이터 캐시 + resolve 인트라요청 메모이즈 (T13-B)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/tiptap/service/TiptapVariableService.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/tiptap/service/TiptapVariableServiceTest.java`

**배경:** (1) `getMetadata`(52–64)는 준정적 카탈로그(`findActiveProjectRefs` 1회)라 캐시 적합. (2) `resolve`(80–86)는 토큰 배열을 순회하며 토큰마다 `aggregateByCategory`/`aggregateByProject`(101,103)를 호출 → 같은 `(year, category)` 또는 `(year, projectCode)`가 여러 항목(requestAmount/allocatedAmount/allocationRate)으로 반복되면 동일 집계를 중복 조회. 인트라요청 `Map` 메모이즈로 호출당 고유 키 1회로 줄인다.

- [ ] **Step 1: 실패 테스트 작성 (RED)**

`resolve` 메모이즈는 순수 Mockito로 검증 가능(캐시 프록시 불필요). `tokenParser`/`budgetStatusRepository`를 `@Mock`으로 둔다.

```java
    @Test
    @DisplayName("resolve: 동일 (year,category) 토큰 3종은 집계 쿼리를 1회만 호출한다")
    void resolve_memoizesAggregatePerRequest() {
        // tokenParser 스텁: 3개 토큰 모두 IT_BUDGET/2026, item만 다름
        given(tokenParser.parse("2026.itBudget.requestAmount"))
                .willReturn(new ParseResult(true, 2026, TiptapTokenParser.Category.IT_BUDGET, null, "requestAmount"));
        given(tokenParser.parse("2026.itBudget.allocatedAmount"))
                .willReturn(new ParseResult(true, 2026, TiptapTokenParser.Category.IT_BUDGET, null, "allocatedAmount"));
        given(tokenParser.parse("2026.itBudget.allocationRate"))
                .willReturn(new ParseResult(true, 2026, TiptapTokenParser.Category.IT_BUDGET, null, "allocationRate"));
        given(budgetStatusRepository.aggregateByCategory(2026, "IT_BUDGET"))
                .willReturn(new AggregatedAmount(90_000_000_000L, 76_000_000_000L));

        service.resolve(java.util.List.of(
                "2026.itBudget.requestAmount",
                "2026.itBudget.allocatedAmount",
                "2026.itBudget.allocationRate"));

        verify(budgetStatusRepository, times(1)).aggregateByCategory(2026, "IT_BUDGET");
    }
```

> `ParseResult`/`Category`/`AggregatedAmount`의 실제 시그니처(생성자 인자 순서/타입)를 확인해 단언을 맞춘다. `AggregatedAmount`가 record라면 위 생성자 형태를 실제 필드 순서에 맞춘다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.tiptap.service.TiptapVariableServiceTest"`
Expected: FAIL — 현재 토큰마다 집계 호출 → 3회.

- [ ] **Step 3: 구현 (GREEN)**

`getMetadata`에 `@Cacheable` 추가:

```java
import org.springframework.cache.annotation.Cacheable;
...
    // 활성 사업 변경 시 캐시 무효화는 후속 과제(무TTL ConcurrentMap) — TASK.md
    @Cacheable("tiptapMetadata")
    public MetadataResponse getMetadata() { ... }
```

`resolve`에 인트라요청 메모이즈 도입:

```java
    public ResolveResponse resolve(List<String> tokens) {
        Map<String, ResolvedValue> results = new LinkedHashMap<>();
        Map<String, AggregatedAmount> aggCache = new java.util.HashMap<>(); // 인트라요청 메모이즈
        for (String token : tokens) {
            results.put(token, resolveOne(token, aggCache));
        }
        return new ResolveResponse(results);
    }

    private ResolvedValue resolveOne(String token, Map<String, AggregatedAmount> aggCache) {
        ParseResult parsed = tokenParser.parse(token);
        if (!parsed.valid()) {
            return ResolvedValue.invalid();
        }
        String aggKey = parsed.category() == TiptapTokenParser.Category.PROJ
                ? "P|" + parsed.year() + "|" + parsed.projectCode()
                : "C|" + parsed.year() + "|" + parsed.category().name();
        AggregatedAmount agg = aggCache.computeIfAbsent(aggKey, k -> switch (parsed.category()) {
            case IT_BUDGET, CAP_BUDGET, OPEX ->
                    budgetStatusRepository.aggregateByCategory(parsed.year(), parsed.category().name());
            case PROJ ->
                    budgetStatusRepository.aggregateByProject(parsed.year(), parsed.projectCode());
        });

        if (agg == null || (agg.requestSum() == null && agg.allocatedSum() == null)) {
            return ResolvedValue.missing();
        }

        return switch (parsed.item()) {
            case "requestAmount" -> agg.requestSum() == null
                    ? ResolvedValue.missing()
                    : ResolvedValue.ok(formatAmount(agg.requestSum()));
            case "allocatedAmount" -> agg.allocatedSum() == null
                    ? ResolvedValue.missing()
                    : ResolvedValue.ok(formatAmount(agg.allocatedSum()));
            case "allocationRate" -> formatRate(agg);
            default -> ResolvedValue.invalid();
        };
    }
```

> `Category` enum 참조 경로(`TiptapTokenParser.Category`)를 실제 import에 맞춰 조정. `computeIfAbsent` 람다가 `null`을 반환하면 메모이즈되지 않으나(다음 동일 키 재조회) 동작상 무해.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.tiptap.service.TiptapVariableServiceTest"`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/tiptap/service/TiptapVariableService.java src/test/java/com/kdb/it/common/system/tiptap/service/TiptapVariableServiceTest.java && git commit -m "perf: cache tiptap metadata and memoize aggregates per resolve request"
```

---

## Task 7: 메뉴 athByMenu 캐시 + 쓰기 evict (T13-C)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuAuthMapProvider.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java:39-80`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java`(create/update/delete)
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuAuthMapProviderTest.java`(컨텍스트 기반)

**배경:** `athByMenu()`(74–80)는 `cmenuaRepository.findAllActive()` 전체 로드 후 `mnuId→Set<athId>` Map을 빌드한다. 매 트리 조회(`getMenuTree`/`getAdminMenuTree`)마다 호출되나 메뉴-권한 매핑은 거의 정적이다.

> **self-invocation 함정:** `@Cacheable`을 같은 빈 내부에서 호출하면 프록시를 우회해 캐시가 적용되지 않는다. `getMenuTree`/`getAdminMenuTree`가 `this.athByMenu()`를 호출하므로, 캐시 적용을 보장하려면 **별도 빈으로 분리**하여 주입받아 호출한다. 본 태스크는 `MenuAuthMapProvider`(@Component)를 신설한다.

- [ ] **Step 1: 실패 테스트 작성 (RED)**

Create `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuAuthMapProviderTest.java`:

```java
package com.kdb.it.domain.menu.service;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.kdb.it.config.JpaAuditConfig;
import com.kdb.it.domain.menu.repository.CmenuaRepository;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

/**
 * 메뉴 권한 매핑 캐시 검증 — 연속 호출 시 Cmenua 전체 조회는 1회만.
 */
@SpringJUnitConfig
@ContextConfiguration(classes = {JpaAuditConfig.class, MenuAuthMapProvider.class})
class MenuAuthMapProviderTest {

    @Autowired private MenuAuthMapProvider provider;
    @MockBean private CmenuaRepository cmenuaRepository;

    @Test
    @DisplayName("getMenuAuthMap 캐시: 연속 호출 시 Cmenua 전체 조회는 1회만 발생한다")
    void menuAuthMap_cached() {
        given(cmenuaRepository.findAllActive()).willReturn(List.of());

        provider.getMenuAuthMap();
        provider.getMenuAuthMap();

        verify(cmenuaRepository, times(1)).findAllActive();
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.menu.service.MenuAuthMapProviderTest"`
Expected: 컴파일 실패(`MenuAuthMapProvider` 없음).

- [ ] **Step 3: Provider 신설 + MenuQueryService 위임 (GREEN)**

Create `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuAuthMapProvider.java`:

```java
package com.kdb.it.domain.menu.service;

import com.kdb.it.domain.menu.entity.Cmenua;
import com.kdb.it.domain.menu.repository.CmenuaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * 메뉴ID→권한ID 집합 매핑 제공자.
 *
 * <p>별도 빈으로 분리한 이유: {@code @Cacheable}은 동일 빈 내부 self-invocation 시 프록시를 우회해
 * 캐시가 적용되지 않는다. {@link MenuQueryService}가 본 빈을 주입받아 호출해야 캐시가 동작한다.
 * 메뉴/권한 변경 시 {@code menuAuthMap} 캐시를 evict 해야 정합이 유지된다(AdminMenuService).</p>
 */
@Component
@RequiredArgsConstructor
public class MenuAuthMapProvider {

    private final CmenuaRepository cmenuaRepository;

    /** 활성 Cmenua를 mnuId→권한ID 집합으로 빌드. 캐시명: menuAuthMap. */
    @Cacheable("menuAuthMap")
    public Map<String, Set<String>> getMenuAuthMap() {
        Map<String, Set<String>> map = new HashMap<>();
        for (Cmenua a : cmenuaRepository.findAllActive()) {
            map.computeIfAbsent(a.getMnuId(), k -> new HashSet<>()).add(a.getAthId());
        }
        return map;
    }
}
```

`MenuQueryService.java` 수정: 생성자 주입에 `MenuAuthMapProvider`를 추가하고, private `athByMenu()`(74–80)를 제거한 뒤 두 호출처(41,58)를 `menuAuthMapProvider.getMenuAuthMap()`으로 교체.

```java
    private final MenuAuthMapProvider menuAuthMapProvider;
    ...
    // getMenuTree
    Map<String, Set<String>> athByMenu = menuAuthMapProvider.getMenuAuthMap();
    ...
    // getAdminMenuTree
    applyAthIds(tree, menuAuthMapProvider.getMenuAuthMap());
```

> 캐시가 반환한 Map은 공유 인스턴스다. `applyAthIds`/`isAllowed`는 읽기만 하므로 안전하나, 호출처가 Map을 변형하지 않는지 확인(현재 코드는 읽기 전용). 변형 가능성이 있으면 방어 복사.

- [ ] **Step 4: AdminMenuService evict 추가**

`AdminMenuService`의 `create`/`update`/`delete`에 `@CacheEvict("menuAuthMap")` 추가(권한 매핑 변경 경로). `move`는 Cmenua 미변경이므로 evict 불필요(주석으로 근거 명시).

```java
import org.springframework.cache.annotation.CacheEvict;
...
    @CacheEvict(value = "menuAuthMap", allEntries = true)
    public String create(MenuDto.UpsertRequest req) { ... }

    @CacheEvict(value = "menuAuthMap", allEntries = true)
    public void update(String mnuId, MenuDto.UpsertRequest req) { ... }

    @CacheEvict(value = "menuAuthMap", allEntries = true)
    public void delete(String mnuId) { ... }
```

> `AdminMenuService`가 `@Service` 빈이고 컨트롤러(외부)에서 호출되므로 `@CacheEvict` 프록시가 동작한다.

- [ ] **Step 5: 테스트 통과 확인 + 메뉴 트리 회귀**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.menu.service.*"`
Expected: PASS(신규 캐시 테스트 + 기존 메뉴 트리 테스트 통과 — 위임 후 동작 동치).

- [ ] **Step 6: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/menu/service/MenuAuthMapProvider.java src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java src/test/java/com/kdb/it/domain/menu/service/MenuAuthMapProviderTest.java && git commit -m "perf: cache menu auth map via dedicated provider and evict on menu writes"
```

---

## Task 8: 인덱스 마이그레이션 묶음 (T14)

**Files:**
- Create: `it_database/migrations/V20260622_003__AddPhase4PerformanceIndexes.sql`

**배경:** 자주 필터/정렬되는 컬럼에 인덱스를 추가한다. 컬럼명은 엔티티 `@Column(name=...)`로 검증 완료. 스키마 접두어(ITPOWN) 미사용(세션 `CURRENT_SCHEMA`). 신규 인덱스 이름은 `IDX_*`로 명명하고, 이미 존재하는 것(`IDX_BESTIM_TGT`, `IDX_BESTIM_STS` — `V20260607_002:32-33`)은 제외한다.

**검증된 사실:**
- `TPRMPP_CDECIM`: FK 물리컬럼 `APF_DCM_NO`, 정렬 `DCR_SQN_SNO`(엔티티 field `dcdMngNo`→물리 `APF_DCM_NO`).
- `TPRMPP_CAPPLM`: `APF_PRG_STS_C`(진행상태), `DCD_REQ_USID`(요청자).
- `TPRMPP_BRDOCM`/`TPRMPP_BRIVGM`: `DOC_MNG_NO`,`DOC_VRS_SNO`,`DEL_YN`.
- `TPRMPP_BASCTM`: 부서 JOIN `ABUS_MNG_NO`/`SNO` + `DEL_YN`.
- `TPRMPP_BCMMTM`: `IT_PTL_ASCT_ID`,`DEL_YN`,`ENO`.
- 4단계 마스터(`TPRMPP_BESTIM`/`BDELIM`/`BCONTM`/`BPAYMM`): 공통 `DEL_YN`,`LST_YN`,`BG_PRN_TC`,`CNCD_RFR_NO`,`IT_PTL_STS_TC`, 정렬 `FST_ENR_DTM`(검증: Bdelim/Bcontm/Bpaymm 엔티티 동일 컬럼).
- `TPRMPP_BPAYTM`: 마스터 JOIN FK `DOC_MNG_NO`,`DOC_VRS_SNO`.
- `TPRMPP_CMENUM`/`TPRMPP_CMENUA`: 둘 다 `BaseEntity` 상속(`DEL_YN` 존재). `findAllActive`는 `DEL_YN='N'` 필터.
- 실시간로그: `V_ITPAPP_LOG_FEED`는 **VIEW** → 직접 인덱스 불가 → 본 묶음에서 **SKIP**(언더라잉 로그 테이블 인덱싱은 별도 조사 후 후속 과제).

- [ ] **Step 1: 마이그레이션 파일 작성**

Create `it_database/migrations/V20260622_003__AddPhase4PerformanceIndexes.sql`:

```sql
-- V20260622_003__AddPhase4PerformanceIndexes.sql
-- Phase 4 (T14) 성능 인덱스 묶음.
-- 대상: 결재(CDECIM/CAPPLM), 요구사항(BRDOCM/BRIVGM), 협의회(BASCTM/BCMMTM),
--       사업집행 4단계 마스터(BESTIM/BDELIM/BCONTM/BPAYMM)·상세(BPAYTM), 메뉴(CMENUM/CMENUA).
-- 스키마 접두어 미사용(세션 CURRENT_SCHEMA=ITPOWN). 컬럼명은 엔티티 @Column 검증 완료.
-- 주의(SKIP): 실시간로그 피드는 V_ITPAPP_LOG_FEED(뷰)라 직접 인덱스 불가 → 본 묶음 제외(후속 조사).
-- BESTIM은 V20260607_002에서 IDX_BESTIM_TGT/IDX_BESTIM_STS 이미 생성됨 → 중복 제외.

-- ── 결재 ──────────────────────────────────────────────
-- 결재선 조회(findByDcdMngNoOrderByDcrSqnSnoAsc / In) 가속
CREATE INDEX IDX_CDECIM_APF_SQN ON TPRMPP_CDECIM (APF_DCM_NO, DCR_SQN_SNO);
-- 대시보드 사용자별 진행상태 카운트(countPending/InProgress/RejectedByEno) 가속
CREATE INDEX IDX_CAPPLM_REQ_STS ON TPRMPP_CAPPLM (DCD_REQ_USID, APF_PRG_STS_C);

-- ── 요구사항 ──────────────────────────────────────────
-- 최신버전/버전조회 및 Soft Delete 필터
CREATE INDEX IDX_BRDOCM_DOC_VRS ON TPRMPP_BRDOCM (DOC_MNG_NO, DOC_VRS_SNO, DEL_YN);
-- 검토의견 목록(findByDocMngNoAndDocVrsSnoAndDelYn...)
CREATE INDEX IDX_BRIVGM_DOC_VRS ON TPRMPP_BRIVGM (DOC_MNG_NO, DOC_VRS_SNO, DEL_YN);

-- ── 협의회 ────────────────────────────────────────────
-- 부서 JOIN(ABUS_MNG_NO/SNO) + Soft Delete
CREATE INDEX IDX_BASCTM_ABUS_DEL ON TPRMPP_BASCTM (ABUS_MNG_NO, SNO, DEL_YN);
-- 위원 목록(findByItPtlAsctIdAndDelYn) + 위원 본인 배정 조회(ENO)
CREATE INDEX IDX_BCMMTM_ASCT_DEL ON TPRMPP_BCMMTM (IT_PTL_ASCT_ID, DEL_YN);
CREATE INDEX IDX_BCMMTM_ENO_DEL  ON TPRMPP_BCMMTM (ENO, DEL_YN);

-- ── 사업집행 4단계 마스터: 목록 필터(상태/대상/최신/삭제) + 정렬(FST_ENR_DTM) ──
-- BESTIM: 기존 TGT/STS 외 복합·정렬 보강
CREATE INDEX IDX_BESTIM_LIST    ON TPRMPP_BESTIM (DEL_YN, LST_YN, IT_PTL_STS_TC, CNCD_RFR_NO);
CREATE INDEX IDX_BESTIM_FST_DTM ON TPRMPP_BESTIM (FST_ENR_DTM);
CREATE INDEX IDX_BDELIM_LIST    ON TPRMPP_BDELIM (DEL_YN, LST_YN, BG_PRN_TC, IT_PTL_STS_TC);
CREATE INDEX IDX_BDELIM_FST_DTM ON TPRMPP_BDELIM (FST_ENR_DTM);
CREATE INDEX IDX_BCONTM_LIST    ON TPRMPP_BCONTM (DEL_YN, LST_YN, BG_PRN_TC, IT_PTL_STS_TC);
CREATE INDEX IDX_BCONTM_FST_DTM ON TPRMPP_BCONTM (FST_ENR_DTM);
CREATE INDEX IDX_BPAYMM_LIST    ON TPRMPP_BPAYMM (DEL_YN, LST_YN, BG_PRN_TC, IT_PTL_STS_TC);
CREATE INDEX IDX_BPAYMM_FST_DTM ON TPRMPP_BPAYMM (FST_ENR_DTM);

-- ── 사업집행 상세: 회차별 지급 마스터-상세 JOIN ──
CREATE INDEX IDX_BPAYTM_DOC_VRS ON TPRMPP_BPAYTM (DOC_MNG_NO, DOC_VRS_SNO);

-- ── 메뉴: 활성 필터(DEL_YN='N') ──
CREATE INDEX IDX_CMENUM_DEL ON TPRMPP_CMENUM (DEL_YN);
CREATE INDEX IDX_CMENUA_DEL ON TPRMPP_CMENUA (DEL_YN);
```

> **실행자 검증 의무(중복 인덱스 정리):** 작성 직후 각 테이블의 PK/UK가 이미 동일 선행 컬럼 인덱스를 제공하는지 로컬에서 확인하고 중복은 제거한다. 예) `TPRMPP_BPAYTM` PK가 `(DOC_MNG_NO, DOC_VRS_SNO, ...)`로 시작하면 `IDX_BPAYTM_DOC_VRS`는 중복 → 삭제. `TPRMPP_CMENUA` PK가 `(MNU_ID, ATH_ID)`면 별도 인덱스 불요(DEL_YN 단독만 유지). `TPRMPP_BASCTM` PK가 `IT_PTL_ASCT_ID` 단일이면 부서 JOIN 인덱스는 유효. 확인 SQL: `.\it_database\connect-db.ps1` 접속 후
> `SELECT index_name, column_name, column_position FROM all_ind_columns WHERE table_owner='ITPOWN' AND table_name='TPRMPP_BPAYTM' ORDER BY index_name, column_position;`
> 중복 인덱스는 ORA 오류는 아니나 불필요하므로 정리한다.

- [ ] **Step 2: 컴파일/검증 (로컬)**

Flyway는 `local-ext`/`local-int` 프로파일에서만 동작한다. 로컬 검증 절차:

```bash
cd it_backend && ./gradlew compileJava   # processResources가 V*.sql을 classpath:db/migration에 포함하는지 확인
```

DB 적용 검증(로컬 Oracle 기동 상태):
- `local-ext` 프로파일로 기동하면 신규 `V20260622_003`이 적용된다. 적용 후 `SELECT index_name FROM all_indexes WHERE table_owner='ITPOWN' AND index_name LIKE 'IDX_%' ORDER BY 1;`로 생성 확인.
- 또는 Flyway Gradle 태스크 구성 시 `./gradlew flywayValidate`. dev/prod는 DBA가 검토 후 수동 적용.

Expected: 마이그레이션이 오류 없이 적용되고 모든 IDX_* 인덱스가 생성됨(중복 제거 반영 후).

- [ ] **Step 3: 커밋**

```bash
cd /c/it && git add it_database/migrations/V20260622_003__AddPhase4PerformanceIndexes.sql && git commit -m "perf: add Phase 4 performance indexes (approval/doc/council/4-step/menu)"
```

---

## Task 9: 시퀀스 CACHE 20 마이그레이션 (T15)

**Files:**
- Create: `it_database/migrations/V20260622_004__AlterSequencesCache20.sql`

**배경:** 다음 시퀀스가 모두 `NOCACHE`로 생성되어 동시 채번 시 SGA 캐시 미사용으로 경합/IO가 증가한다. 검증된 정의:
- `SEQ_CINFMM` — 알림 채번(`CinfmmRepository.getNextVal`, line 22). 베이스라인 DDL(`ITPOWN_DDL_live.sql`).
- `SEQ_BESTIM`/`SEQ_BDELIM`/`SEQ_BCONTM`/`SEQ_BPAYMM` — 4단계 마스터 채번. 모두 `... NOCACHE NOCYCLE`로 생성됨(`V20260607_002:105`, `_005:80`, `_008:84`, `_011:165`). (이미 `CACHE 20`인 로그 시퀀스 `*L`은 대상 아님.)

`ALTER SEQUENCE ... CACHE 20`은 멱등하며 기존 현재값/시드에 영향 없다.

- [ ] **Step 1: 마이그레이션 파일 작성**

Create `it_database/migrations/V20260622_004__AlterSequencesCache20.sql`:

```sql
-- V20260622_004__AlterSequencesCache20.sql
-- Phase 4 (T15) 채번 시퀀스 NOCACHE -> CACHE 20.
-- 대상: 알림(SEQ_CINFMM), 사업집행 4단계 마스터(SEQ_BESTIM/BDELIM/BCONTM/BPAYMM).
-- 모두 V20260607_* 및 베이스라인에서 NOCACHE로 생성됨(검증 완료).
-- ALTER CACHE는 멱등하고 현재값/CYCLE 설정에 영향 없음. 스키마 접두어 미사용.

ALTER SEQUENCE SEQ_CINFMM CACHE 20;
ALTER SEQUENCE SEQ_BESTIM CACHE 20;
ALTER SEQUENCE SEQ_BDELIM CACHE 20;
ALTER SEQUENCE SEQ_BCONTM CACHE 20;
ALTER SEQUENCE SEQ_BPAYMM CACHE 20;
```

> **주의:** `SEQ_CINFMM`은 `CYCLE`로 생성되어 있을 수 있다(`CinfmmRepository` 주석: "99,999,999 도달 시 CYCLE"). `ALTER SEQUENCE ... CACHE 20`은 CYCLE 설정을 보존한다. CYCLE+CACHE 조합에서 `CACHE`가 사이클 범위보다 크면 ORA-04013이 나지만 20은 충분히 작아 안전. 실행자는 적용 전 현재값을 확인한다: `SELECT sequence_name, cache_size, cycle_flag FROM all_sequences WHERE sequence_owner='ITPOWN' AND sequence_name IN ('SEQ_CINFMM','SEQ_BESTIM','SEQ_BDELIM','SEQ_BCONTM','SEQ_BPAYMM');`

- [ ] **Step 2: 검증 (로컬)**

`local-ext` 프로파일 기동 후 적용 확인:
- `SELECT sequence_name, cache_size FROM all_sequences WHERE sequence_owner='ITPOWN' AND sequence_name IN ('SEQ_CINFMM','SEQ_BESTIM','SEQ_BDELIM','SEQ_BCONTM','SEQ_BPAYMM');` → 모두 `CACHE_SIZE=20`.
- 컴파일: `cd it_backend && ./gradlew compileJava`.
- dev/prod는 DBA 수동 적용.

Expected: 5개 시퀀스 `CACHE_SIZE=20`.

- [ ] **Step 3: 커밋**

```bash
cd /c/it && git add it_database/migrations/V20260622_004__AlterSequencesCache20.sql && git commit -m "perf: set CACHE 20 on notification/4-step master sequences"
```

---

## Task 10: 캐시정합 — 벌크 업데이트 영속성 컨텍스트 정합 (T16-정합 슬라이스)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java:85-90`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/repository/CinfmmRepositoryImpl.java:72-84`(주석)
- Modify(조건부): `it_backend/src/main/java/com/kdb/it/domain/council/service/FeasibilityService.java`

**배경:** JPQL/QueryDSL 벌크 `UPDATE`는 영속성 컨텍스트(1차 캐시)를 우회한다. 동일 트랜잭션에서 같은 엔티티를 이후 조회하면 stale 상태가 보일 수 있다.
- `CouncilRepository.updateProjectStatus`(85–90)는 네이티브 `@Modifying` UPDATE. 동일 트랜잭션 내 BPROJM 재조회 흐름이면 `clearAutomatically=true`(+ `flushAutomatically=true`)가 필요.
- `CinfmmRepositoryImpl.markAllReadByRmsEno`(72–84)는 QueryDSL `update().execute()`. 호출 후 동일 트랜잭션에서 알림 엔티티를 재조회하지 않으므로(서비스 `markAllRead`는 카운트만 반환) 현재 안전 → 정합 근거 주석만 추가.
- `FeasibilityService`의 벌크/물리 변경 후 후속 조회가 있으면 명시 `flush`/`clear` 검토.

- [ ] **Step 1: CouncilRepository.updateProjectStatus 정합 옵션 추가**

교체 전:

```java
    @Modifying
    @Query(value = "UPDATE TPRMPP_BPROJM SET IT_PTL_STS_TC = :prjSts WHERE ABUS_MNG_NO = :abusMngNo AND SNO = :sno",
            nativeQuery = true)
    int updateProjectStatus(@Param("abusMngNo") String abusMngNo,
```

교체 후:

```java
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE TPRMPP_BPROJM SET IT_PTL_STS_TC = :prjSts WHERE ABUS_MNG_NO = :abusMngNo AND SNO = :sno",
            nativeQuery = true)
    int updateProjectStatus(@Param("abusMngNo") String abusMngNo,
```

> `clearAutomatically=true`는 영속성 컨텍스트를 비우므로, 같은 트랜잭션에서 호출 전 로드해 dirty 상태인 엔티티가 있으면 변경이 유실될 수 있다. `flushAutomatically=true`로 벌크 UPDATE 전 보류 변경을 먼저 flush한다. 호출 흐름(협의회 신청 상태 전이)에 보류 dirty BPROJM이 없는지 확인 후 적용한다.

- [ ] **Step 2: markAllRead 정합 근거 주석**

`CinfmmRepositoryImpl.markAllReadByRmsEno`에 정합 주석 추가(코드 변경 없음):

```java
    // 벌크 UPDATE는 1차 캐시를 우회하나, 호출자(NotificationService.markAllRead)는 갱신 건수만
    // 반환하고 동일 트랜잭션에서 해당 알림 엔티티를 재조회하지 않으므로 clear가 불필요하다.
    @Override
    public long markAllReadByRmsEno(String rmsEno) {
```

- [ ] **Step 3: FeasibilityService flush 검토 (조건부)**

`FeasibilityService`를 읽어 벌크/물리 변경 후 동일 트랜잭션 재조회가 있는지 확인한다. 있으면 변경 직후 `entityManager.flush()` 또는 해당 리포지토리 `@Modifying(flushAutomatically=true, clearAutomatically=true)` 적용. 없으면 본 스텝은 **No-op**로 두고 Self-Review/커밋 메시지에 "재조회 흐름 없음 — 변경 불요"로 기록한다.

- [ ] **Step 4: 컴파일/회귀 테스트**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.domain.council.*"`
Expected: BUILD SUCCESSFUL. 협의회 상태 전이 관련 테스트가 있으면 통과.

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java src/main/java/com/kdb/it/common/notification/repository/CinfmmRepositoryImpl.java && git commit -m "fix: ensure persistence-context consistency for bulk project-status update"
```

---

## Task 11: 통합 검증 & 백로그 동기화

**Files:**
- Modify: `TASK.md`, `docs/superpowers/specs/2026-06-22-backend-improvement-roadmap-design.md`(메모)

- [ ] **Step 1: 영향 범위 테스트 재실행**

Run:
```bash
cd it_backend && ./gradlew test \
  --tests "com.kdb.it.domain.budget.document.service.*" \
  --tests "com.kdb.it.common.approval.service.ApplicationServiceTest" \
  --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest" \
  --tests "com.kdb.it.common.notification.service.*" \
  --tests "com.kdb.it.common.system.tiptap.service.TiptapVariableServiceTest" \
  --tests "com.kdb.it.domain.menu.service.*"
```
Expected: PASS.

- [ ] **Step 2: 전체 클린 테스트**

Run: `cd it_backend && ./gradlew clean test`
Expected: BUILD SUCCESSFUL. (인증/결재/QueryDSL 집계/캐시 공통 영향 변경이므로 clean 재검증 — CLAUDE.md §5.9.)

- [ ] **Step 3: 백로그 동기화**

`TASK.md`의 🟡 성능 섹션에서 본 Phase 4로 완료된 항목(T12 4건, T13 3건, T14, T15, T16 정합)을 `TASK_DONE.md`로 이관하고 근거(`파일:라인`, `V20260622_003/004`)를 명시. SKIP/후속 항목(실시간로그 뷰 인덱스, ConcurrentMap TTL 한계, T16 목록 프로젝션 DTO)은 TASK.md에 잔존 표기.

스펙 문서에 한 줄 메모: "T14 실시간로그 피드는 뷰 대상이라 인덱스 보류(언더라잉 로그 테이블 인덱싱 별도 조사); T13은 ConcurrentMapCacheManager 기반 evict-on-write 1단계 적용(Caffeine TTL은 후속); T16 목록 프로젝션 DTO는 별도 계획으로 분리."

- [ ] **Step 4: 커밋**

```bash
cd /c/it && git add TASK.md docs/superpowers/specs/2026-06-22-backend-improvement-roadmap-design.md && git commit -m "docs: move Phase 4 performance items to TASK_DONE"
```

---

## Self-Review

- **Spec coverage:**
  - **T12** — ServiceRequestDoc 작성자명(Task 1), ReviewComment 작성자명(Task 2), ApplicationService 결재자 N+1 + getPendingCount COUNT(Task 3), BudgetWorkService getProjectSummary/computeMplAdjustment(Task 4) 구현. **이미 배치 완료된 항목**(ProjectService.enrichProjectListBatch, CostService.enrichCostListBatch, BudgetWorkService.getSummary 집계)은 범위 메모에 근거와 함께 제외. **Schedule/Evaluation 사용자명·Council 위원**: 조사 결과 `ScheduleService.buildUserMap`/`EvaluationService.buildUserMapFromEvaluations`가 이미 배치 패턴(주석 "N+1 방지")으로 보이나 **`findByEnoIn` 사용 여부 미확정** — 실행자는 해당 헬퍼를 최종 확인하고, 단건 `findById`면 Task 1 패턴으로 추가 태스크를 생성한다(잠재 잔여 항목으로 표기).
  - **T13** — 캐시 이름 등록 + 알림 unread-count(Task 5), Tiptap metadata+resolve 메모이즈(Task 6), 메뉴 athByMenu(Task 7, self-invocation 회피 위해 Provider 분리).
  - **T14** — 인덱스 묶음 `V20260622_003`(Task 8). 실시간로그 피드는 뷰라 SKIP(근거 명시).
  - **T15** — 시퀀스 CACHE 20 `V20260622_004`(Task 9).
  - **T16** — bulk update 정합(Task 10: updateProjectStatus clearAutomatically, markAllRead 주석, FeasibilityService flush 검토). **프로젝션 DTO 치환**(ProjectRepositoryImpl/CostRepositoryImpl 전체엔티티→DTO, Native Object[]→@SqlResultSetMapping, CouncilRepository.findWithDetails, 4단계 상세 JOIN, applyAthIds 최소화)은 표면적이 매우 넓고 동작 동치 검증 비용이 커 **본 계획의 정합 슬라이스에서 분리**하여 후속 계획(Plan: "T16 목록 프로젝션 DTO")으로 명시 분리 — 의도된 범위 축소.
- **Placeholder scan:** 모든 코드 스텝에 실제 before/after 코드 포함. Task 4 테스트 픽스처와 Task 8 인덱스 중복 검증은 픽스처/스키마 실측이 필요한 부분을 검증 의무로 명시(완전 자동화 불가 영역) — 실행자 확인 지점을 분명히 표기.
- **Type/사실 consistency:**
  - `ApproverRepository.findByDcdMngNoInOrderByDcrSqnSnoAsc(List<String>)`(line 56)·`UserRepository.findByEnoIn(Collection<String>)`(line 76) 실재 확인 → 신규 메서드 불요.
  - 5개 시퀀스 모두 `NOCACHE` 실재 확인(grep 근거: V20260607_002:105, _005:80, _008:84, _011:165; SEQ_CINFMM은 베이스라인 DDL).
  - 인덱스 컬럼명 전부 엔티티 `@Column(name=...)` 검증: CDECIM 물리 `APF_DCM_NO`/`DCR_SQN_SNO`(field `dcdMngNo`→물리 `APF_DCM_NO` 불일치 주의 — 물리명 사용), CAPPLM `DCD_REQ_USID`/`APF_PRG_STS_C`, 4단계 공통 `DEL_YN/LST_YN/BG_PRN_TC/CNCD_RFR_NO/IT_PTL_STS_TC/FST_ENR_DTM`, BPAYTM `DOC_MNG_NO/DOC_VRS_SNO`, CMENUM/CMENUA `DEL_YN`(둘 다 BaseEntity 상속).
  - 마이그레이션 버전 `V20260622_003`/`_004`는 기존 마지막 `_002` 다음 번호(충돌 없음).
- **캐시 self-invocation 함정:** Task 7에서 `@Cacheable` 메서드의 동일 빈 내부 호출 우회 문제를 해소하기 위해 `MenuAuthMapProvider`로 분리. Task 5/6의 `unreadCount`/`getMetadata`는 컨트롤러(외부 빈)에서 호출되므로 프록시 경유가 보장됨(Tiptap `resolve` 메모이즈는 캐시 무관 순수 로직이라 프록시 불필요).
- **TTL 한계:** `ConcurrentMapCacheManager`는 TTL 미지원 → evict-on-write로 단일 인스턴스 정합 보장, 스펙의 60s/1d TTL은 Caffeine 도입(후속) 전까지 미적용임을 명시. 운영 다중 인스턴스 캐시 정합은 후속 과제.
- **주의(실행자):** Task 3의 `countBySearchCondition`은 `searchByCondition`과 **동일 조건 조립**을 공유해야 결과가 일치한다(CAPPLA EXISTS 등 누락 금지). Task 8/9의 마이그레이션은 적용 전 PK/UK 중복 인덱스·시퀀스 CYCLE 설정을 로컬에서 실측 후 확정한다.
