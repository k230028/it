# 소유권/권한 검증 하드닝 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인증된 임의 사용자가 타인·타부서 리소스를 수정·삭제·조회하는 수평적 권한 상승/데이터 노출을, 기존 `OwnershipVerifier`(403)와 `FileOwnershipChecker`를 누락된 호출 지점에 연결하여 닫는다.

**Architecture:** 신규 인프라 없음. 서비스 계층 쓰기 경로에 `OwnershipVerifier.verifyOwnerOrAdmin(ownerEno, user)`를 상태 검증 이전에 삽입하고, 파일 읽기/메타/일괄삭제 경로에 `FileOwnershipChecker`를 연결한다. 대시보드는 비관리자 요청 `bbrC`를 JWT 클레임으로 강제하고, 게시판 소유권 예외를 403으로 표준화한다.

**Tech Stack:** Spring Boot 4.1, Java 25, JUnit 5 + Mockito + AssertJ, Gradle. 예외→HTTP 매핑은 `GlobalExceptionHandler`(이미 `AccessDeniedException`→403 매핑 존재).

**Spec:** [docs/superpowers/specs/2026-06-22-ownership-authorization-hardening-design.md](../specs/2026-06-22-ownership-authorization-hardening-design.md)

**선행 계획(기반):** [docs/superpowers/plans/2026-06-22-ownership-verifier-foundation.md](2026-06-22-ownership-verifier-foundation.md) — `OwnershipVerifier` 유틸 + `GlobalExceptionHandler` 403 매핑 + `QnaService` 첫 적용을 이미 구축. 본 계획은 그 foundation이 "후속 계획(4단계 롤아웃 / 파일·요구사항정의서)"으로 예고한 적용 작업의 통합본이다. 따라서 본 계획은 `OwnershipVerifier`·403 매핑이 **이미 존재**함을 전제한다.

---

## 공통 규약 (모든 Task 적용)

- 소유권 검증은 **상태/존재 검증보다 먼저** 호출한다 (권한 없는 사용자에게 상태 정보 비노출).
- 검증 코드: `OwnershipVerifier.verifyOwnerOrAdmin(entity.getFstEnrUsid(), user);`
- import: `import com.kdb.it.common.system.security.OwnershipVerifier;`
- 실패 시 `org.springframework.security.access.AccessDeniedException`(403) 발생 → 기존 `GlobalExceptionHandler.handleAccessDenied()`가 403으로 매핑.
- 테스트 사용자 헬퍼는 기존 패턴을 따른다:
  - 소유자/일반: `new CustomUserDetails("E0001", List.of("ITPZZ001"), "18001")`
  - 타인: `new CustomUserDetails("E0002", List.of("ITPZZ001"), "18001")`
  - 관리자: `new CustomUserDetails("E0099", List.of("ITPAD001"), "18001")`
- **기존 테스트 영향(중요):** 4개 집행 서비스 테스트의 write 메서드 픽스처 엔티티는 현재 `fstEnrUsid`가 없다. 소유권 검증이 상태 검증보다 먼저 실행되므로, 기존 성공·상태거부 테스트가 `AccessDeniedException`으로 깨진다. 각 Task에서 해당 픽스처에 `.fstEnrUsid("E0001")`를 추가한다(요청자 E0001 = 소유자).
- 각 Task 종료 시 빌드 검증: `cd it_backend && ./gradlew test`. Phase 종료 시 보안 공통 영향이므로 `./gradlew clean test`.

---

## Phase 1 — 집행 4단계 소유권 검증

### Task 1: EstimateService 소유권 검증

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/estimate/service/EstimateServiceTest.java`

- [ ] **Step 1: 실패 테스트 작성** — `EstimateServiceTest`에 타인 거부 테스트 추가

`EstimateServiceTest` 클래스에 `requester()`/`admin()` 옆에 타인 헬퍼와 중첩 테스트 클래스를 추가한다:

```java
    /** 타인 (소유자가 아닌 일반 사용자) */
    CustomUserDetails other() {
        return new CustomUserDetails("E0002", List.of("ITPZZ001"), "18001");
    }

    @Nested
    @DisplayName("소유권 검증 — 타인 차단")
    class OwnershipTests {

        private Bestim draftOwnedByE0001() {
            return Bestim.builder()
                    .rqmBgReqDocNo("REQ-2026-0001").docVrsSno(1)
                    .lstYn("Y").bgPrnTc("100").cncdRfrNo("PRJ-2026-0001")
                    .stsTc("41").reqCone("내용").fstEnrUsid("E0001").build();
        }

        @Test
        @DisplayName("타인이 수정하면 AccessDeniedException")
        void update_deniedForOther() {
            when(estimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn("REQ-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(draftOwnedByE0001()));
            assertThatThrownBy(() -> service.update("REQ-2026-0001", new EstimateDto.UpdateRequest("x"), other()))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }

        @Test
        @DisplayName("관리자는 타인 문서도 수정 가능")
        void update_allowedForAdmin() {
            Bestim e = draftOwnedByE0001();
            when(estimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn("REQ-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(e));
            service.update("REQ-2026-0001", new EstimateDto.UpdateRequest("수정"), admin());
            assertThat(e.getReqCone()).isEqualTo("수정");
        }

        @Test
        @DisplayName("타인이 삭제하면 AccessDeniedException")
        void delete_deniedForOther() {
            when(estimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn("REQ-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(draftOwnedByE0001()));
            assertThatThrownBy(() -> service.delete("REQ-2026-0001", other()))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }
    }
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.estimate.service.EstimateServiceTest"`
Expected: FAIL — `update_deniedForOther`/`delete_deniedForOther`가 AccessDeniedException 대신 통과(예외 없음) 또는 IllegalState로 실패.

- [ ] **Step 3: 서비스에 소유권 검증 삽입**

`EstimateService.java` 상단 import에 추가:
```java
import com.kdb.it.common.system.security.OwnershipVerifier;
```

`update`, `delete`, `changeStatus`, `saveLines`의 `loadCurrent(docNo)` 직후(상태 검증 이전)에 한 줄 추가. 예시 `update`:
```java
    @Transactional
    public void update(String docNo, EstimateDto.UpdateRequest req, CustomUserDetails user) {
        Bestim e = loadCurrent(docNo);
        OwnershipVerifier.verifyOwnerOrAdmin(e.getFstEnrUsid(), user);
        if (!STS_DRAFT.equals(e.getStsTc())) {
            throw new IllegalStateException("작성중 상태에서만 수정할 수 있습니다.");
        }
        e.updateRequest(req.reqCone());
    }
```
동일하게 `delete`(loadCurrent 직후), `changeStatus`(loadCurrent 직후), `saveLines`(loadCurrent 직후)에 `OwnershipVerifier.verifyOwnerOrAdmin(e.getFstEnrUsid(), user);` 삽입.

- [ ] **Step 4: 기존 픽스처 수정** — 기존 write 테스트가 소유자(E0001)를 갖도록 보정

`EstimateServiceTest`의 다음 테스트들에서 엔티티 빌더에 `.fstEnrUsid("E0001")`를 추가한다(요청자 `requester()`=E0001이 소유자가 되도록):
- `UpdateTests`의 `update_succeedsWhenDraft`, `update_rejectsWhenNotDraft`, `update_rejectsWhenDone`
- `DeleteTests`의 `delete_succeedsWhenDraft`, `delete_rejectsWhenInProgress`, `delete_rejectsWhenDone`
- `changeStatus_*` 6개 테스트의 엔티티
- `saveLines_*` 및 `SaveLinesExtraTests`의 마스터 `Bestim` 엔티티

예시(`update_succeedsWhenDraft`):
```java
            Bestim e = Bestim.builder()
                    .rqmBgReqDocNo("REQ-2026-0001").docVrsSno(1)
                    .lstYn("Y").bgPrnTc("100").cncdRfrNo("PRJ-2026-0001")
                    .stsTc("41").reqCone("기존 내용").fstEnrUsid("E0001").build();
```
(나머지도 동일하게 각 `Bestim.builder()...build()`에 `.fstEnrUsid("E0001")` 추가.)

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.estimate.service.EstimateServiceTest"`
Expected: PASS (신규 소유권 테스트 + 보정된 기존 테스트 모두 통과)

- [ ] **Step 6: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java \
        it_backend/src/test/java/com/kdb/it/domain/estimate/service/EstimateServiceTest.java
git commit -m "feat: EstimateService 쓰기 경로 소유권 검증(OwnershipVerifier) 적용"
```

---

### Task 2: DeliberationService 소유권 검증

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/deliberation/service/DeliberationService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/deliberation/service/DeliberationServiceTest.java`

대상 메서드: `update`, `delete`, `changeStatus`, `saveResult` (각 `loadCurrent` 직후). 엔티티 타입 `Bdelim`, 상태코드 DRAFT="51".

- [ ] **Step 1: 실패 테스트 작성**

`DeliberationServiceTest`에 타인 헬퍼와 소유권 테스트 추가:
```java
    CustomUserDetails other() {
        return new CustomUserDetails("E0002", List.of("ITPZZ001"), "18001");
    }

    @Nested
    @DisplayName("소유권 검증 — 타인 차단")
    class OwnershipTests {

        private Bdelim draftOwnedByE0001() {
            return Bdelim.builder()
                    .docMngNo("DLB-2026-0001").docVrsSno(1).lstYn("Y")
                    .bgPrnTc("100").cncdRfrNo("PRJ-2026-0001")
                    .stsTc("51").reqCone("내용").taskDbrOmtYn("N").fstEnrUsid("E0001").build();
        }

        @Test
        @DisplayName("타인이 수정하면 AccessDeniedException")
        void update_deniedForOther() {
            when(deliberationRepository.findByDocMngNoAndLstYnAndDelYn("DLB-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(draftOwnedByE0001()));
            assertThatThrownBy(() -> service.update("DLB-2026-0001", new DeliberationDto.UpdateRequest("x"), other()))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }

        @Test
        @DisplayName("관리자는 타인 문서도 수정 가능")
        void update_allowedForAdmin() {
            Bdelim e = draftOwnedByE0001();
            when(deliberationRepository.findByDocMngNoAndLstYnAndDelYn("DLB-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(e));
            service.update("DLB-2026-0001", new DeliberationDto.UpdateRequest("수정"), admin());
            assertThat(e.getReqCone()).isEqualTo("수정");
        }

        @Test
        @DisplayName("타인이 삭제하면 AccessDeniedException")
        void delete_deniedForOther() {
            when(deliberationRepository.findByDocMngNoAndLstYnAndDelYn("DLB-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(draftOwnedByE0001()));
            assertThatThrownBy(() -> service.delete("DLB-2026-0001", other()))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }
    }
```
(`admin()` 헬퍼가 없으면 `new CustomUserDetails("E0099", List.of("ITPAD001"), "18001")`로 추가.)

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.deliberation.service.DeliberationServiceTest"`
Expected: FAIL

- [ ] **Step 3: 서비스에 소유권 검증 삽입**

import 추가: `import com.kdb.it.common.system.security.OwnershipVerifier;`
`update`/`delete`/`changeStatus`/`saveResult`의 `Bdelim e = loadCurrent(docNo);` 직후 삽입:
```java
        OwnershipVerifier.verifyOwnerOrAdmin(e.getFstEnrUsid(), user);
```

- [ ] **Step 4: 기존 픽스처 수정**

`DeliberationServiceTest`의 update/delete/changeStatus/saveResult 관련 기존 테스트의 `Bdelim.builder()...build()`에 `.fstEnrUsid("E0001")` 추가.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.deliberation.service.DeliberationServiceTest"`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/deliberation/service/DeliberationService.java \
        it_backend/src/test/java/com/kdb/it/domain/deliberation/service/DeliberationServiceTest.java
git commit -m "feat: DeliberationService 쓰기 경로 소유권 검증 적용"
```

---

### Task 3: ContractService 소유권 검증

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/contract/service/ContractService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/contract/service/ContractServiceTest.java`

대상 메서드: `update`, `delete`, `changeStatus`, `saveContract`. 엔티티 `Bcontm`, DRAFT="61".

- [ ] **Step 1: 실패 테스트 작성**

```java
    CustomUserDetails other() {
        return new CustomUserDetails("E0002", List.of("ITPZZ001"), "18001");
    }

    @Nested
    @DisplayName("소유권 검증 — 타인 차단")
    class OwnershipTests {

        private Bcontm draftOwnedByE0001() {
            return Bcontm.builder()
                    .docMngNo("CTR-2026-0001").docVrsSno(1).lstYn("Y")
                    .bgPrnTc("100").cncdRfrNo("PRJ-2026-0001")
                    .stsTc("61").reqCone("내용").fstEnrUsid("E0001").build();
        }

        @Test
        @DisplayName("타인이 수정하면 AccessDeniedException")
        void update_deniedForOther() {
            when(contractRepository.findByDocMngNoAndLstYnAndDelYn("CTR-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(draftOwnedByE0001()));
            assertThatThrownBy(() -> service.update("CTR-2026-0001", new ContractDto.UpdateRequest("x"), other()))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }

        @Test
        @DisplayName("관리자는 타인 문서도 수정 가능")
        void update_allowedForAdmin() {
            Bcontm e = draftOwnedByE0001();
            when(contractRepository.findByDocMngNoAndLstYnAndDelYn("CTR-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(e));
            service.update("CTR-2026-0001", new ContractDto.UpdateRequest("수정"), admin());
            assertThat(e.getReqCone()).isEqualTo("수정");
        }

        @Test
        @DisplayName("타인이 삭제하면 AccessDeniedException")
        void delete_deniedForOther() {
            when(contractRepository.findByDocMngNoAndLstYnAndDelYn("CTR-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(draftOwnedByE0001()));
            assertThatThrownBy(() -> service.delete("CTR-2026-0001", other()))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }
    }
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.contract.service.ContractServiceTest"`
Expected: FAIL

- [ ] **Step 3: 서비스에 소유권 검증 삽입**

import 추가 후 `update`/`delete`/`changeStatus`/`saveContract`의 `Bcontm e = loadCurrent(docNo);` 직후 `OwnershipVerifier.verifyOwnerOrAdmin(e.getFstEnrUsid(), user);` 삽입.

- [ ] **Step 4: 기존 픽스처 수정**

`ContractServiceTest`의 write 관련 기존 테스트 `Bcontm.builder()...build()`에 `.fstEnrUsid("E0001")` 추가.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.contract.service.ContractServiceTest"`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/contract/service/ContractService.java \
        it_backend/src/test/java/com/kdb/it/domain/contract/service/ContractServiceTest.java
git commit -m "feat: ContractService 쓰기 경로 소유권 검증 적용"
```

---

### Task 4: PaymentService 소유권 검증

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/service/PaymentService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/payment/service/PaymentServiceTest.java`

대상 메서드: `update`, `delete`, `changeStatus`, `savePayments`. 엔티티 `Bpaymm`, DRAFT="71".

- [ ] **Step 1: 실패 테스트 작성**

```java
    CustomUserDetails other() {
        return new CustomUserDetails("E0002", List.of("ITPZZ001"), "18001");
    }

    @Nested
    @DisplayName("소유권 검증 — 타인 차단")
    class OwnershipTests {

        private Bpaymm draftOwnedByE0001() {
            return Bpaymm.builder()
                    .docMngNo("PAY-2026-0001").docVrsSno(1).lstYn("Y")
                    .bgPrnTc("100").cncdRfrNo("PRJ-2026-0001")
                    .stsTc("71").reqCone("내용").fstEnrUsid("E0001").build();
        }

        @Test
        @DisplayName("타인이 수정하면 AccessDeniedException")
        void update_deniedForOther() {
            when(paymentRepository.findByDocMngNoAndLstYnAndDelYn("PAY-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(draftOwnedByE0001()));
            assertThatThrownBy(() -> service.update("PAY-2026-0001", new PaymentDto.UpdateRequest("x", null, null), other()))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }

        @Test
        @DisplayName("타인이 삭제하면 AccessDeniedException")
        void delete_deniedForOther() {
            when(paymentRepository.findByDocMngNoAndLstYnAndDelYn("PAY-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(draftOwnedByE0001()));
            assertThatThrownBy(() -> service.delete("PAY-2026-0001", other()))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }
    }
```
주의: `PaymentDto.UpdateRequest`의 실제 생성자 시그니처(`reqCone`, `cttNm`, `cttAmt`)는 `PaymentService.update`가 `req.reqCone()/req.cttNm()/req.cttAmt()`를 호출하므로 3-인자다. 위 `new PaymentDto.UpdateRequest("x", null, null)`가 맞는지 `PaymentDto`를 열어 확인하고 불일치 시 실제 시그니처로 교체.

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.payment.service.PaymentServiceTest"`
Expected: FAIL

- [ ] **Step 3: 서비스에 소유권 검증 삽입**

import 추가 후 `update`/`delete`/`changeStatus`/`savePayments`의 `Bpaymm e = loadCurrent(docNo);` 직후 `OwnershipVerifier.verifyOwnerOrAdmin(e.getFstEnrUsid(), user);` 삽입.

- [ ] **Step 4: 기존 픽스처 수정**

`PaymentServiceTest`의 write 관련 기존 테스트 `Bpaymm.builder()...build()`에 `.fstEnrUsid("E0001")` 추가. (`savePayments` 테스트의 마스터 엔티티 포함)

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.payment.service.PaymentServiceTest"`
Expected: PASS

- [ ] **Step 6: Phase 1 전체 재검증 + 커밋**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.estimate.*" --tests "com.kdb.it.domain.deliberation.*" --tests "com.kdb.it.domain.contract.*" --tests "com.kdb.it.domain.payment.*"
git add it_backend/src/main/java/com/kdb/it/domain/payment/service/PaymentService.java \
        it_backend/src/test/java/com/kdb/it/domain/payment/service/PaymentServiceTest.java
git commit -m "feat: PaymentService 쓰기 경로 소유권 검증 적용"
```
Expected: 4개 도메인 테스트 모두 PASS

---

## Phase 2 — 요구사항정의서 소유권 검증

### Task 5: ServiceRequestDoc 컨트롤러 principal 추가 + 서비스 소유권 검증

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/ServiceRequestDocController.java:130,145,166`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ServiceRequestDocService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ServiceRequestDocServiceTest.java`

설계: `updateDocument`/`deleteDocument`/`createNewVersion`에 `CustomUserDetails user`를 추가하고, 대상 문서의 최신 버전 소유자(`FST_ENR_USID`) 기준 검증. `createDocument`는 신규 생성이므로 소유권 검증 대상이 아니다(변경 없음).

- [ ] **Step 1: 실패 테스트 작성** — 서비스 단위 테스트

`ServiceRequestDocServiceTest`(없으면 신규 생성)에 다음을 추가. 기존 테스트가 있으면 헬퍼/import만 추가:
```java
package com.kdb.it.domain.budget.document.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.budget.document.dto.ServiceRequestDocDto;
import com.kdb.it.domain.budget.document.entity.Brdocm;
import com.kdb.it.domain.budget.document.repository.ServiceRequestDocRepository;
import com.kdb.it.common.iam.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ServiceRequestDocServiceTest {

    @Mock ServiceRequestDocRepository serviceRequestDocRepository;
    @Mock UserRepository cuserIRepository;

    ServiceRequestDocService service;

    CustomUserDetails owner() { return new CustomUserDetails("E0001", List.of("ITPZZ001"), "18001"); }
    CustomUserDetails other() { return new CustomUserDetails("E0002", List.of("ITPZZ001"), "18001"); }
    CustomUserDetails admin() { return new CustomUserDetails("E0099", List.of("ITPAD001"), "18001"); }

    @BeforeEach
    void setUp() {
        service = new ServiceRequestDocService(serviceRequestDocRepository, cuserIRepository);
    }

    private Brdocm latestOwnedByE0001() {
        // DOC_VRS_SNO 저장 정수 1 = 화면 0.01
        return Brdocm.builder()
                .docMngNo("DOC-2026-0001").docVrsSno(1).delYn("N").fstEnrUsid("E0001").build();
    }

    @Test
    @DisplayName("타인이 수정하면 AccessDeniedException")
    void update_deniedForOther() {
        when(serviceRequestDocRepository.findTopByDocMngNoAndDelYnOrderByDocVrsSnoDesc("DOC-2026-0001", "N"))
                .thenReturn(Optional.of(latestOwnedByE0001()));
        assertThatThrownBy(() -> service.updateDocument("DOC-2026-0001",
                new ServiceRequestDocDto.UpdateRequest(), other()))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test
    @DisplayName("타인이 삭제하면 AccessDeniedException")
    void delete_deniedForOther() {
        when(serviceRequestDocRepository.findTopByDocMngNoAndDelYnOrderByDocVrsSnoDesc("DOC-2026-0001", "N"))
                .thenReturn(Optional.of(latestOwnedByE0001()));
        assertThatThrownBy(() -> service.deleteDocument("DOC-2026-0001", null, other()))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
}
```
주의:
- `Brdocm.builder()`의 필드명(`docMngNo`/`docVrsSno`/`fstEnrUsid`)과 `ServiceRequestDocDto.UpdateRequest`의 기본 생성자/세터 존재 여부를 실제 클래스에서 확인 후 보정. `UpdateRequest`가 빌더/세터만 있으면 그에 맞게 인스턴스 생성.
- 생성자 인자 순서(`serviceRequestDocRepository`, `cuserIRepository`)는 `ServiceRequestDocService` 필드 선언 순서와 일치시킨다.

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.document.service.ServiceRequestDocServiceTest"`
Expected: FAIL — 컴파일 에러(메서드 시그니처에 user 없음).

- [ ] **Step 3: 서비스 시그니처 변경 + 소유권 검증**

`ServiceRequestDocService.java`:
- import 추가:
```java
import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.common.system.security.OwnershipVerifier;
```
- `updateDocument`:
```java
    @Transactional
    public String updateDocument(String docMngNo, ServiceRequestDocDto.UpdateRequest request, CustomUserDetails user) {
        Brdocm document = serviceRequestDocRepository
                .findTopByDocMngNoAndDelYnOrderByDocVrsSnoDesc(docMngNo, "N")
                .orElseThrow(() -> new CustomGeneralException("존재하지 않는 문서관리번호입니다: " + docMngNo));
        OwnershipVerifier.verifyOwnerOrAdmin(document.getFstEnrUsid(), user);

        String sanitizedCone = HtmlSanitizer.sanitize(request.getRedtConeInf());
        document.update(request.getReqTtl(), sanitizedCone, request.getReqDttNo(),
                request.getBzDttNm(), request.getRvwFsgTlmDt());
        return docMngNo;
    }
```
- `createNewVersion`: 시그니처에 `CustomUserDetails user` 추가, 최신 버전 조회(`latest`) 직후 `OwnershipVerifier.verifyOwnerOrAdmin(latest.getFstEnrUsid(), user);` 삽입.
- `deleteDocument`: 시그니처를 `deleteDocument(String docMngNo, BigDecimal version, CustomUserDetails user)`로 변경. 메서드 진입부에서 최신 버전 기준 소유권을 먼저 검증:
```java
    @Transactional
    public void deleteDocument(String docMngNo, BigDecimal version, CustomUserDetails user) {
        Brdocm latest = serviceRequestDocRepository
                .findTopByDocMngNoAndDelYnOrderByDocVrsSnoDesc(docMngNo, "N")
                .orElseThrow(() -> new CustomGeneralException("존재하지 않는 문서관리번호입니다: " + docMngNo));
        OwnershipVerifier.verifyOwnerOrAdmin(latest.getFstEnrUsid(), user);

        if (version == null) {
            List<Brdocm> all = serviceRequestDocRepository.findAllByDocMngNoAndDelYn(docMngNo, "N");
            if (all.isEmpty()) {
                throw new CustomGeneralException("존재하지 않는 문서관리번호입니다: " + docMngNo);
            }
            all.forEach(Brdocm::delete);
        } else {
            Brdocm document = serviceRequestDocRepository
                    .findByDocMngNoAndDocVrsSnoAndDelYn(docMngNo, DocVersionCodec.toStored(version), "N")
                    .orElseThrow(() -> new CustomGeneralException(
                            "해당 버전의 문서를 찾을 수 없습니다: " + docMngNo + " (v" + version + ")"));
            document.delete();
        }
    }
```

- [ ] **Step 4: 컨트롤러 시그니처 변경**

`ServiceRequestDocController.java`:
- import 추가:
```java
import com.kdb.it.common.system.security.CustomUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
```
- `createNewVersion`/`updateDocument`/`deleteDocument`에 `@AuthenticationPrincipal CustomUserDetails user` 파라미터를 추가하고 서비스 호출에 전달:
```java
    @PostMapping("/{docMngNo}/versions")
    public ResponseEntity<String> createNewVersion(
            @PathVariable("docMngNo") String docMngNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        BigDecimal newVrs = serviceRequestDocService.createNewVersion(docMngNo, user);
        return ResponseEntity.created(URI.create("/api/documents/" + docMngNo + "/versions"))
                .body(newVrs.toPlainString());
    }

    @PutMapping("/{docMngNo}")
    public ResponseEntity<String> updateDocument(
            @PathVariable("docMngNo") String docMngNo,
            @org.springframework.web.bind.annotation.RequestBody ServiceRequestDocDto.UpdateRequest request,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(serviceRequestDocService.updateDocument(docMngNo, request, user));
    }

    @DeleteMapping("/{docMngNo}")
    public ResponseEntity<Void> deleteDocument(
            @PathVariable("docMngNo") String docMngNo,
            @RequestParam(value = "version", required = false) BigDecimal version,
            @AuthenticationPrincipal CustomUserDetails user) {
        serviceRequestDocService.deleteDocument(docMngNo, version, user);
        return ResponseEntity.noContent().build();
    }
```
(기존 `@Operation` 어노테이션은 유지.)

- [ ] **Step 5: 컨트롤러 테스트 보정**

`ServiceRequestDocControllerTest`가 있으면 해당 호출에 principal 주입이 필요하다. WebMvcTest라면 `@WithMockUser` 또는 `SecurityMockMvcRequestPostProcessors.user(...)`로 principal을 설정하고, 변경된 서비스 메서드 시그니처(`user` 추가)에 맞게 `verify`/`when` 스텁을 갱신한다. 컨트롤러가 standalone MockMvc면 `@AuthenticationPrincipal` 주입을 위한 argument resolver 설정을 확인한다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.document.*"`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/document/
git add it_backend/src/test/java/com/kdb/it/domain/budget/document/
git commit -m "feat: 요구사항정의서 수정/삭제/새버전 소유권 검증 적용"
```

---

## Phase 3 — 파일 권한

### Task 6: FileOwnershipChecker 읽기권한 boolean 분리 + 읽기 경로 연결

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/FileOwnershipChecker.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/controller/FileController.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/FileOwnershipCheckerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/controller/FileControllerTest.java`

설계: 단건 읽기(`getFile`/`downloadFile`/`previewFile`)는 컨트롤러에서 `checkReadAccess`(throw) 연결. 목록(`getFiles`)은 `FileService`가 로드한 엔티티를 `canRead(Cfilem, user)` boolean으로 필터링. 두 메서드의 게시판 가시성 로직은 단일 `canRead`로 DRY 통합.

- [ ] **Step 1: 실패 테스트 작성** — `FileOwnershipCheckerTest`에 canRead 테스트 추가

```java
    @Test
    @DisplayName("canRead: 비게시판 파일은 항상 읽기 허용")
    void canRead_nonBoardAlwaysTrue() {
        Cfilem file = Cfilem.builder().flMpnId("FL_00000001").pkColNm("요구사항정의서").delYn("N").build();
        assertThat(checker.canRead(file, requester())).isTrue();
    }

    @Test
    @DisplayName("canRead: 비공개 게시판 게시물 파일은 비관리자에게 거부")
    void canRead_hiddenBoardPostDeniedForNonAdmin() {
        Cfilem file = Cfilem.builder().flMpnId("FL_00000002").pkColNm("공통게시판").pkCone("POST-1").delYn("N").build();
        Cblbcm post = Cblbcm.builder().nacMngNo("POST-1").sreYn("N").delYn("N").build();
        when(boardPostRepository.findByNacMngNoAndDelYn("POST-1", "N")).thenReturn(java.util.Optional.of(post));
        assertThat(checker.canRead(file, requester())).isFalse();
    }
```
(`requester()`/`checker`/mock 필드는 기존 `FileOwnershipCheckerTest` 패턴을 따른다. 기존 테스트에 `requester()` 헬퍼가 없으면 `new CustomUserDetails("E0001", List.of("ITPZZ001"), "18001")` 추가. `Cblbcm`/`Cfilem` 빌더 필드명은 실제 엔티티에서 확인.)

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.FileOwnershipCheckerTest"`
Expected: FAIL — `canRead` 메서드 없음(컴파일 에러).

- [ ] **Step 3: FileOwnershipChecker에 canRead 추가 + checkReadAccess 위임**

`FileOwnershipChecker.java`의 `checkReadAccess`와 `verifyBoardFileAccess`를 다음으로 교체:
```java
    /**
     * 파일 다운로드/미리보기 읽기 권한 검증 — 실패 시 예외.
     *
     * @param flMpnId 파일매핑ID
     * @param user    현재 사용자
     * @throws CustomGeneralException 파일이 없거나 접근 권한이 없는 경우
     */
    public void checkReadAccess(String flMpnId, CustomUserDetails user) {
        Cfilem file = fileRepository.findByFlMpnIdAndDelYn(flMpnId, "N")
                .orElseThrow(() -> new CustomGeneralException("파일을 찾을 수 없습니다: " + flMpnId));
        if (!canRead(file, user)) {
            throw new CustomGeneralException("파일 다운로드 권한이 없습니다.");
        }
    }

    /**
     * 읽기 가능 여부 판정(목록 필터링용, 예외 없이 boolean 반환).
     *
     * <p>주식별자컬럼명="공통게시판"이면 게시물 공개 여부(화면여부·공개기간)를 확인하고,
     * 그 외 원본구분은 읽기를 허용합니다. 관리자는 모든 파일 읽기 허용.</p>
     *
     * @param file 검증 대상 파일 엔티티
     * @param user 현재 사용자(null 가능)
     * @return 읽기 가능하면 true
     */
    public boolean canRead(Cfilem file, CustomUserDetails user) {
        if (!"공통게시판".equals(file.getPkColNm())) {
            return true;
        }
        if (user != null && user.isAdmin()) {
            return true;
        }
        Cblbcm post = boardPostRepository.findByNacMngNoAndDelYn(file.getPkCone(), "N").orElse(null);
        if (post == null) {
            return false;
        }
        LocalDate today = LocalDate.now();
        return "Y".equals(post.getSreYn())
                && (post.getSttDt() == null || !post.getSttDt().isAfter(today))
                && (post.getEndDt() == null || !post.getEndDt().isBefore(today));
    }
```
(`verifyBoardFileAccess` private 메서드는 삭제.)

- [ ] **Step 4: FileService.getFiles 필터링 + 시그니처 변경**

`FileService.java`:
- import 추가:
```java
import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.infra.file.FileOwnershipChecker;
```
- 필드 추가(생성자 주입):
```java
    private final FileOwnershipChecker fileOwnershipChecker;
```
- `getFiles` 시그니처를 `getFiles(FileDto.SearchCondition condition, CustomUserDetails user)`로 변경하고, 마지막 반환을 필터링으로 교체:
```java
        return list.stream()
                .filter(f -> fileOwnershipChecker.canRead(f, user))
                .map(this::toResponse)
                .toList();
```

- [ ] **Step 5: FileController 읽기 경로 연결**

`FileController.java`:
- `getFiles`/`getFile`/`downloadFile`/`previewFile`에 `@AuthenticationPrincipal CustomUserDetails userDetails` 추가.
- `getFile`/`downloadFile`/`previewFile`은 서비스 호출 전에 `fileOwnershipChecker.checkReadAccess(flMpnId, userDetails);` 호출.
- `getFiles`는 `fileService.getFiles(condition, userDetails)`로 전달.

예시:
```java
        @GetMapping
        public ResponseEntity<List<FileDto.Response>> getFiles(
                        @ModelAttribute FileDto.SearchCondition condition,
                        @AuthenticationPrincipal CustomUserDetails userDetails) {
                return ResponseEntity.ok(fileService.getFiles(condition, userDetails));
        }

        @GetMapping("/{flMpnId}")
        public ResponseEntity<FileDto.Response> getFile(
                        @PathVariable("flMpnId") String flMpnId,
                        @AuthenticationPrincipal CustomUserDetails userDetails) {
                fileOwnershipChecker.checkReadAccess(flMpnId, userDetails);
                return ResponseEntity.ok(fileService.getFile(flMpnId));
        }

        @GetMapping("/{flMpnId}/download")
        public ResponseEntity<org.springframework.core.io.Resource> downloadFile(
                        @PathVariable("flMpnId") String flMpnId,
                        @AuthenticationPrincipal CustomUserDetails userDetails) {
                fileOwnershipChecker.checkReadAccess(flMpnId, userDetails);
                FileService.FileDownloadResult result = fileService.downloadFile(flMpnId);
                // ... 기존 헤더 구성 동일 ...
        }
```
(`previewFile`도 동일하게 `checkReadAccess` 선행. 기존 헤더/응답 구성은 유지.)

- [ ] **Step 6: 기존 테스트 보정 + 회귀 테스트**

`FileControllerTest`: `getFiles`가 `getFiles(condition, user)` 2-인자로 바뀌므로 스텁/verify 갱신. 비-게시판 파일 다운로드가 여전히 허용되는지(회귀 없음) 확인하는 테스트 추가/유지:
```java
    @Test
    @DisplayName("비게시판 파일 미리보기는 인증 사용자에게 허용된다(회귀 방지)")
    void preview_nonBoardAllowed() throws Exception {
        // checkReadAccess는 비게시판이면 통과, downloadFile 결과 mock 후 200 기대
    }
```
(구체 스텁은 기존 `FileControllerTest` 패턴에 맞춰 작성.)

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.*"`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/file/
git add it_backend/src/test/java/com/kdb/it/infra/file/
git commit -m "feat: 파일 읽기 경로(목록/단건/다운로드/미리보기) 읽기권한 검증 연결"
```

---

### Task 7: FileController 메타수정·일괄삭제 소유권 검증

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/controller/FileController.java:127,153`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java` (deleteFilesByOrc 소유권)
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/controller/FileControllerTest.java`

설계:
- `updateFileMeta`: 컨트롤러에서 `fileOwnershipChecker.checkOwnership(flMpnId, userDetails.getUsername())` 선행(단건 삭제와 동일 패턴).
- `deleteFilesByOrc`: 대상 레코드(pkColNm+pkCone)에 연결된 파일들의 소유자/관리자 검증. 비관리자는 본인 소유 파일만 일괄 삭제 가능. `FileService.deleteFilesByOrc`에 `CustomUserDetails user`를 추가하고, 로드한 파일 중 타인 소유가 있으면 `AccessDeniedException`.

- [ ] **Step 1: 실패 테스트 작성**

`FileControllerTest`에 메타수정 소유권 테스트, `FileService`(또는 컨트롤러) 테스트에 일괄삭제 소유권 테스트 추가:
```java
    @Test
    @DisplayName("타인 파일 메타수정은 차단된다")
    void updateMeta_deniedForOther() throws Exception {
        org.mockito.Mockito.doThrow(new com.kdb.it.exception.CustomGeneralException("본인이 업로드한 파일만"))
                .when(fileOwnershipChecker).checkOwnership("FL_00000001", "E0002");
        // PUT /api/files/FL_00000001 → 400 기대(checkOwnership은 현재 CustomGeneralException=400)
    }
```
`deleteFilesByOrc` 소유권은 서비스 단위로 테스트(아래 Step 3 구현에 맞춤):
```java
    @Test
    @DisplayName("일괄삭제: 타인 소유 파일이 섞이면 AccessDeniedException")
    void deleteFilesByOrc_deniedWhenOtherOwned() {
        Cfilem mine = Cfilem.builder().flMpnId("FL_1").pkColNm("요구사항정의서").pkCone("DOC-1").fstEnrUsid("E0001").delYn("N").build();
        Cfilem others = Cfilem.builder().flMpnId("FL_2").pkColNm("요구사항정의서").pkCone("DOC-1").fstEnrUsid("E0002").delYn("N").build();
        when(fileRepository.findAllByPkColNmAndPkConeAndDelYn("요구사항정의서", "DOC-1", "N"))
                .thenReturn(List.of(mine, others));
        assertThatThrownBy(() -> fileService.deleteFilesByOrc("요구사항정의서", "DOC-1",
                new CustomUserDetails("E0001", List.of("ITPZZ001"), "18001")))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.*"`
Expected: FAIL (컴파일/검증 미구현)

- [ ] **Step 3: FileService.deleteFilesByOrc 소유권 검증**

`FileService.java`:
- import 추가: `import org.springframework.security.access.AccessDeniedException;` (CustomUserDetails import는 Task 6에서 추가됨)
- `deleteFilesByOrc` 시그니처를 `deleteFilesByOrc(String pkColNm, String pkCone, CustomUserDetails user)`로 변경:
```java
    @Transactional
    public int deleteFilesByOrc(String pkColNm, String pkCone, CustomUserDetails user) {
        List<Cfilem> files = fileRepository.findAllByPkColNmAndPkConeAndDelYn(pkColNm, pkCone, "N");
        boolean admin = user != null && user.isAdmin();
        if (!admin) {
            String eno = user == null ? null : user.getUsername();
            boolean hasOther = files.stream()
                    .anyMatch(f -> eno == null || !eno.equals(f.getFstEnrUsid()));
            if (hasOther) {
                throw new AccessDeniedException("본인이 업로드한 파일만 일괄 삭제할 수 있습니다.");
            }
        }
        files.forEach(Cfilem::delete);
        return files.size();
    }
```

- [ ] **Step 4: FileController 연결**

`FileController.java`:
- `updateFileMeta`에 `@AuthenticationPrincipal CustomUserDetails userDetails` 추가, 서비스 호출 전 `fileOwnershipChecker.checkOwnership(flMpnId, userDetails.getUsername());` 삽입.
- `deleteFilesByOrc`에 `@AuthenticationPrincipal CustomUserDetails userDetails` 추가, `fileService.deleteFilesByOrc(request.getPkColNm(), request.getPkCone(), userDetails)`로 전달.

```java
        @PutMapping("/{flMpnId}")
        public ResponseEntity<String> updateFileMeta(
                        @PathVariable("flMpnId") String flMpnId,
                        @org.springframework.web.bind.annotation.RequestBody FileDto.UpdateRequest request,
                        @AuthenticationPrincipal CustomUserDetails userDetails) {
                fileOwnershipChecker.checkOwnership(flMpnId, userDetails.getUsername());
                String updatedFlMpnId = fileService.updateFileMeta(flMpnId, request);
                return ResponseEntity.ok(updatedFlMpnId);
        }

        @DeleteMapping("/bulk")
        public ResponseEntity<Integer> deleteFilesByOrc(
                        @org.springframework.web.bind.annotation.RequestBody FileDto.BulkDeleteRequest request,
                        @AuthenticationPrincipal CustomUserDetails userDetails) {
                int deletedCount = fileService.deleteFilesByOrc(request.getPkColNm(), request.getPkCone(), userDetails);
                return ResponseEntity.ok(deletedCount);
        }
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.*"`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/file/
git add it_backend/src/test/java/com/kdb/it/infra/file/
git commit -m "feat: 파일 메타수정/원본기준 일괄삭제 소유권 검증 적용"
```

---

## Phase 4 — bbrC 대시보드 강제 + 403 표준화 + 문서

### Task 8: 요구사항정의서 대시보드 bbrC 서버측 강제

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/ServiceRequestDocController.java:183,197`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/document/controller/ServiceRequestDocControllerTest.java`

설계: `getDashboard`/`getBadgeCount`에서 비관리자는 요청 `bbrC`를 무시하고 `user.getBbrC()`로 강제. 관리자만 임의 `bbrC` 허용. 서비스(`getDashboard(String bbrC)`)는 변경하지 않고 컨트롤러에서 유효 bbrC를 계산해 전달.

- [ ] **Step 1: 실패 테스트 작성**

`ServiceRequestDocControllerTest`(WebMvcTest 가정)에 추가:
```java
    @Test
    @DisplayName("비관리자는 타부서 bbrC를 요청해도 본인 부서로 강제된다")
    void dashboard_nonAdminForcedToOwnBbrC() throws Exception {
        // principal: eno=E0001, bbrC=18001 / 요청 파라미터 bbrC=99999
        // 기대: service.getDashboard("18001") 호출 (99999 무시)
    }

    @Test
    @DisplayName("관리자는 요청 bbrC로 조회한다")
    void dashboard_adminUsesRequestedBbrC() throws Exception {
        // principal: ITPAD001 / 요청 bbrC=99999 → service.getDashboard("99999")
    }
```
(MockMvc principal 주입은 기존 테스트의 보안 설정/`@WithMockUser` 패턴을 따른다. mock 서비스에서 `verify(service).getDashboard("18001")`로 검증.)

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.document.controller.ServiceRequestDocControllerTest"`
Expected: FAIL

- [ ] **Step 3: 컨트롤러 유효 bbrC 계산**

`ServiceRequestDocController.java`(import는 Task 5에서 추가됨):
```java
    @GetMapping("/dashboard")
    public ResponseEntity<ServiceRequestDocDto.DashboardResponse> getDashboard(
            @RequestParam("bbrC") String bbrC,
            @AuthenticationPrincipal CustomUserDetails user) {
        String effectiveBbrC = user.isAdmin() ? bbrC : user.getBbrC();
        return ResponseEntity.ok(serviceRequestDocService.getDashboard(effectiveBbrC));
    }

    @GetMapping("/badge-count")
    public ResponseEntity<ServiceRequestDocDto.BadgeCountResponse> getBadgeCount(
            @RequestParam("bbrC") String bbrC,
            @AuthenticationPrincipal CustomUserDetails user) {
        String effectiveBbrC = user.isAdmin() ? bbrC : user.getBbrC();
        return ResponseEntity.ok(serviceRequestDocService.getBadgeCount(effectiveBbrC));
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.document.controller.ServiceRequestDocControllerTest"`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/ServiceRequestDocController.java \
        it_backend/src/test/java/com/kdb/it/domain/budget/document/controller/ServiceRequestDocControllerTest.java
git commit -m "feat: 요구사항정의서 대시보드/배지 bbrC 서버측 강제(JWT 클레임 기준)"
```

---

### Task 9: 게시판 소유권 예외 403 표준화

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardPostService.java:360-364`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardCommentService.java:213-217`
- Test: `it_backend/src/test/java/com/kdb/it/common/board/service/BoardPostServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/board/service/BoardCommentServiceTest.java`

설계: `verifyCanModify`가 던지던 `CustomGeneralException`(400)을 `OwnershipVerifier.verifyOwnerOrAdmin`(403)으로 통일. 동작 동등(관리자 또는 본인 허용), 예외 타입만 변경.

- [ ] **Step 1: 실패 테스트 작성/갱신**

기존에 본인 아님 케이스가 `CustomGeneralException`을 기대한다면 `AccessDeniedException`으로 갱신, 없으면 추가:
```java
    @Test
    @DisplayName("타인 게시물 수정 시 AccessDeniedException(403)")
    void update_deniedForOther() {
        // post.fstEnrUsid=E0001, user=E0002 → updatePost 호출 시 AccessDeniedException
    }
```
`BoardCommentServiceTest`도 동일 패턴(댓글 수정).

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.board.service.*"`
Expected: FAIL (현재는 CustomGeneralException)

- [ ] **Step 3: verifyCanModify 표준화**

`BoardPostService.java`:
- import 추가: `import com.kdb.it.common.system.security.OwnershipVerifier;`
- `verifyCanModify` 교체:
```java
    private void verifyCanModify(CustomUserDetails user, Cblbcm post) {
        OwnershipVerifier.verifyOwnerOrAdmin(post.getFstEnrUsid(), user);
    }
```
`BoardCommentService.java`:
- import 추가: `import com.kdb.it.common.system.security.OwnershipVerifier;`
- `verifyCanModify` 교체:
```java
    private void verifyCanModify(CustomUserDetails user, Ccmmtm comment) {
        OwnershipVerifier.verifyOwnerOrAdmin(comment.getFstEnrUsid(), user);
    }
```
(주의: `BoardPostService.verifyCanReadPost`, `verifyCanWrite`, `verifyBbrC`는 의미가 다르므로 변경하지 않는다. `BoardCommentService.canModify`(boolean)도 다른 용도이므로 유지.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.board.service.*"`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/board/service/BoardPostService.java \
        it_backend/src/main/java/com/kdb/it/common/board/service/BoardCommentService.java \
        it_backend/src/test/java/com/kdb/it/common/board/service/
git commit -m "refactor: 게시판 본인 게시물/댓글 수정·삭제 권한 예외 403 표준화(OwnershipVerifier)"
```

---

### Task 10: 문서 갱신 (CLAUDE.md §5.18 + TASK 이관)

**Files:**
- Modify: `it_backend/CLAUDE.md` (§5.18 보안 규칙)
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`

- [ ] **Step 1: CLAUDE.md §5.18 갱신**

`it_backend/CLAUDE.md` §5.18 "보안 규칙(집행 4단계)" 항목에 `OwnershipVerifier`를 소유권 검증 표준 수단으로 명시하고, 집행 4단계·요구사항정의서·파일·게시판 적용 완료 사실을 반영. 예: "쓰기 경로 소유권 검증은 `OwnershipVerifier.verifyOwnerOrAdmin(ownerEno, user)`(`common/system/security`, 실패 시 403)를 표준으로 사용한다. 집행 4단계/요구사항정의서/게시판 수정·삭제, 파일 메타수정·일괄삭제에 적용됨."

- [ ] **Step 2: TASK.md → TASK_DONE.md 이관**

`TASK.md` 🔒 보안 섹션에서 본 계획으로 해소된 항목(집행 4단계 소유권, 요구사항정의서 소유권, FileController 읽기/메타/일괄삭제, dashboard bbrC, 소유권 403 표준화, OwnershipVerifier 문서화)을 제거하고 `TASK_DONE.md`에 "🔐 2026-06-22 소유권/권한 검증 하드닝" 항목으로 이관. **제외 항목(bbrC 리포지토리 필터, changeStatus 역할분기)은 TASK.md에 남긴다.**

- [ ] **Step 3: 전체 재검증**

Run: `cd it_backend && ./gradlew clean test`
Expected: 전체 PASS (보안 공통 영향 최종 검증)

- [ ] **Step 4: 커밋**

```bash
git add it_backend/CLAUDE.md TASK.md TASK_DONE.md
git commit -m "docs: 소유권/권한 검증 하드닝 CLAUDE.md 반영 및 TASK 이관"
```

---

## Self-Review 메모 (작성자 확인 완료)

- **Spec 커버리지:** 포함 8개 항목 → Task 1-4(집행 4단계), Task 5(요구사항정의서), Task 6-7(파일), Task 8(대시보드 bbrC), Task 9(403 표준화), Task 10(문서/TASK). 제외 2개(bbrC 리포 필터·changeStatus 역할분기)는 의도적으로 미포함.
- **기존 테스트 회귀:** Phase 1 각 Task Step 4에서 기존 픽스처에 `.fstEnrUsid("E0001")` 추가로 소유권-먼저 검증에 따른 회귀를 차단.
- **시그니처 일관성:** `OwnershipVerifier.verifyOwnerOrAdmin(String ownerEno, CustomUserDetails user)`, `FileOwnershipChecker.canRead(Cfilem, CustomUserDetails)` / `checkReadAccess(String, CustomUserDetails)` / `checkOwnership(String, String)` 전 Task 동일 사용.
- **확인 필요(구현 시):** `PaymentDto.UpdateRequest`/`ServiceRequestDocDto.UpdateRequest` 생성자 시그니처, `Brdocm`/`Cfilem`/`Cblbcm` 빌더 필드명, 각 컨트롤러 테스트의 principal 주입 방식(WebMvcTest 보안 설정)을 실제 코드로 대조 후 보정.
