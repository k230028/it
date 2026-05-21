# BRDOCM 문서버전 복합키 구현 계획서

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TPRMPP_BRDOCM` 테이블에 `DOC_VRS(NUMBER 4,2)` 컬럼을 추가하고, `(DOC_MNG_NO, DOC_VRS)` 복합키 기반으로 버전 관리 기능을 전 레이어에 구현한다.

**Architecture:** `@IdClass(BrdocmId)` 복합키 패턴(기존 `CdecimId` 패턴과 동일), Spring Data JPA 파생 쿼리 + Native Oracle 쿼리로 버전 조회, Nuxt 4 `useApiFetch`/`$apiFetch` 패턴 유지.

**Tech Stack:** Java 21, Spring Boot 3, JPA/Hibernate, Oracle DB, Nuxt 4, TypeScript, PrimeVue

---

## 파일 구조

| 액션 | 파일 경로 |
|------|-----------|
| 신규 | `it_backend/src/main/java/com/example/it/domain/servicerequest/entity/BrdocmId.java` |
| 수정 | `it_backend/src/main/java/com/example/it/domain/servicerequest/entity/Brdocm.java` |
| 수정 | `it_backend/src/main/java/com/example/it/domain/servicerequest/dto/ServiceRequestDocDto.java` |
| 수정 | `it_backend/src/main/java/com/example/it/domain/servicerequest/repository/ServiceRequestDocRepository.java` |
| 신규 | `it_backend/src/test/java/com/example/it/domain/servicerequest/service/ServiceRequestDocServiceTest.java` |
| 수정 | `it_backend/src/main/java/com/example/it/domain/servicerequest/service/ServiceRequestDocService.java` |
| 수정 | `it_backend/src/main/java/com/example/it/domain/servicerequest/controller/ServiceRequestDocController.java` |
| 수정 | `it_frontend/app/composables/useDocuments.ts` |
| 수정 | `it_frontend/app/pages/info/documents/index.vue` |
| 수정 | `it_frontend/app/pages/info/documents/[id]/index.vue` |

> **경로 확인:** 위 경로는 설계 문서 기준이다. 실제 구현 전 `find it_backend/src -name "Brdocm.java"` 로 실제 경로를 확인하고 조정하라.

---

## Task 1: BrdocmId 복합키 클래스 생성

**Files:**
- Create: `it_backend/src/main/java/com/example/it/domain/servicerequest/entity/BrdocmId.java`

- [ ] **Step 1: 실제 패키지 경로 확인**

```bash
find it_backend/src -name "CdecimId.java"
```

`CdecimId.java` 위치로 `Brdocm.java`와 같은 `entity` 패키지를 특정한다. `Brdocm.java`의 패키지 선언을 읽어 패키지명을 확인한다.

- [ ] **Step 2: BrdocmId.java 생성**

`CdecimId.java`와 동일한 패턴으로 작성한다. 패키지명은 Step 1에서 확인한 값으로 교체한다.

```java
package com.example.it.domain.servicerequest.entity; // 실제 패키지명으로 교체

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.math.BigDecimal;

@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class BrdocmId implements Serializable {
    private String docMngNo;
    private BigDecimal docVrs;
}
```

- [ ] **Step 3: 컴파일 확인**

```bash
cd it_backend && ./gradlew compileJava 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: 커밋**

```bash
git add it_backend/src/main/java/.../entity/BrdocmId.java
git commit -m "feat: BrdocmId 복합키 클래스 추가"
```

---

## Task 2: Brdocm 엔티티 복합키 적용 및 newVersion() 추가

**Files:**
- Modify: `it_backend/src/main/java/com/example/it/domain/servicerequest/entity/Brdocm.java`

- [ ] **Step 1: 현재 Brdocm.java 읽기**

```bash
cat it_backend/src/main/java/.../entity/Brdocm.java
```

현재 `@Id` 필드, `@Builder`/`@SuperBuilder` 여부, 기존 필드 목록을 파악한다.

- [ ] **Step 2: 클래스 레벨 어노테이션 추가**

기존 `@Entity` 등 어노테이션 블록에 `@IdClass(BrdocmId.class)` 추가:

```java
@IdClass(BrdocmId.class)
@Entity
@Table(name = "TPRMPP_BRDOCM")
// ... 기존 어노테이션 유지
public class Brdocm extends BaseEntity {
```

import 추가:
```java
import jakarta.persistence.IdClass;
import java.math.BigDecimal;
```

- [ ] **Step 3: docVrs 필드 추가**

기존 `@Id String docMngNo;` 바로 아래에 추가:

```java
@Id
@Column(name = "DOC_VRS", nullable = false, precision = 4, scale = 2)
private BigDecimal docVrs;
```

- [ ] **Step 4: newVersion() 메서드 추가**

클래스 내 마지막 메서드 위치에 추가. 기존 필드명은 Step 1에서 확인한 실제 필드명을 사용한다.

```java
public Brdocm newVersion(BigDecimal nextVrs) {
    return Brdocm.builder()
        .docMngNo(this.docMngNo)
        .docVrs(nextVrs)
        .reqNm(this.reqNm)
        .reqCone(this.reqCone)
        .reqDtt(this.reqDtt)
        .bzDtt(this.bzDtt)
        .fsgTlm(this.fsgTlm)
        .build();
}
```

> `BaseEntity`의 `@PrePersist`가 `delYn`, `guid`, `guidPrgSno`, `fstEnrDtm`, `fstEnrUsid` 등을 자동 설정하므로 `newVersion()`에서 별도 설정 불필요.

- [ ] **Step 5: 컴파일 확인**

```bash
cd it_backend && ./gradlew compileJava 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 6: 커밋**

```bash
git add it_backend/src/main/java/.../entity/Brdocm.java
git commit -m "feat: Brdocm 엔티티 복합키(docVrs) 및 newVersion() 추가"
```

---

## Task 3: ServiceRequestDocDto 수정

**Files:**
- Modify: `it_backend/src/main/java/com/example/it/domain/servicerequest/dto/ServiceRequestDocDto.java`

- [ ] **Step 1: 현재 DTO 파일 읽기**

```bash
cat it_backend/src/main/java/.../dto/ServiceRequestDocDto.java
```

`CreateRequest.toEntity()` 시그니처와 `Response.fromEntity()` 구조를 파악한다.

- [ ] **Step 2: CreateRequest.toEntity() 수정**

버전을 서버에서 주입받도록 파라미터 추가:

```java
// 변경 전
public Brdocm toEntity(String docMngNo) { ... }

// 변경 후
public Brdocm toEntity(String docMngNo, BigDecimal docVrs) {
    return Brdocm.builder()
        .docMngNo(docMngNo)
        .docVrs(docVrs)
        .reqNm(this.reqNm)
        .reqCone(this.reqCone)
        .reqDtt(this.reqDtt)
        .bzDtt(this.bzDtt)
        .fsgTlm(this.fsgTlm)
        .build();
}
```

- [ ] **Step 3: Response에 docVrs 필드 추가**

```java
@Schema(description = "문서버전")
private BigDecimal docVrs;
```

`fromEntity()` 메서드에 `.docVrs(entity.getDocVrs())` 추가.

- [ ] **Step 4: VersionResponse 내부 클래스 추가**

`Response` 클래스 아래에 신규 추가:

```java
@Getter
@Builder
@Schema(description = "버전 히스토리 응답")
public static class VersionResponse {
    @Schema(description = "문서관리번호")
    private String docMngNo;

    @Schema(description = "문서버전")
    private BigDecimal docVrs;

    @Schema(description = "최초생성시간")
    private Date fstEnrDtm;

    @Schema(description = "마지막수정시간")
    private Date lstChgDtm;

    @Schema(description = "삭제여부")
    private String delYn;

    public static VersionResponse fromEntity(Brdocm entity) {
        return VersionResponse.builder()
            .docMngNo(entity.getDocMngNo())
            .docVrs(entity.getDocVrs())
            .fstEnrDtm(entity.getFstEnrDtm())
            .lstChgDtm(entity.getLstChgDtm())
            .delYn(entity.getDelYn())
            .build();
    }
}
```

- [ ] **Step 5: 컴파일 확인**

```bash
cd it_backend && ./gradlew compileJava 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 6: 커밋**

```bash
git add it_backend/src/main/java/.../dto/ServiceRequestDocDto.java
git commit -m "feat: ServiceRequestDocDto docVrs 필드 및 VersionResponse 추가"
```

---

## Task 4: Repository 수정

**Files:**
- Modify: `it_backend/src/main/java/com/example/it/domain/servicerequest/repository/ServiceRequestDocRepository.java`

- [ ] **Step 1: 현재 Repository 파일 읽기**

```bash
cat it_backend/src/main/java/.../repository/ServiceRequestDocRepository.java
```

기존 메서드 목록과 `JpaRepository` 타입 파라미터를 확인한다.

- [ ] **Step 2: JpaRepository 타입 파라미터 변경**

```java
// 변경 전
public interface ServiceRequestDocRepository extends JpaRepository<Brdocm, String> {

// 변경 후
public interface ServiceRequestDocRepository extends JpaRepository<Brdocm, BrdocmId> {
```

import 추가:
```java
import com.example.it.domain.servicerequest.entity.BrdocmId;
import java.math.BigDecimal;
```

- [ ] **Step 3: 기존 단건 조회 메서드 교체 및 신규 추가**

기존 `findByDocMngNoAndDelYn(String, String): Optional<Brdocm>` 을 아래로 교체/추가:

```java
// 최신 버전 단건 (일반 조회/수정/삭제의 기본)
Optional<Brdocm> findTopByDocMngNoAndDelYnOrderByDocVrsDesc(String docMngNo, String delYn);

// 특정 버전 단건
Optional<Brdocm> findByDocMngNoAndDocVrsAndDelYn(String docMngNo, BigDecimal docVrs, String delYn);

// 전체 버전 목록 (히스토리)
List<Brdocm> findAllByDocMngNoAndDelYnOrderByDocVrsDesc(String docMngNo, String delYn);

// 전체 버전 소프트 삭제용
List<Brdocm> findAllByDocMngNoAndDelYn(String docMngNo, String delYn);
```

- [ ] **Step 4: findLatestVersionsAll() Native 쿼리 추가**

```java
@Query(value = """
    SELECT * FROM TPRMPP_BRDOCM d
    WHERE d.DEL_YN = 'N'
      AND d.DOC_VRS = (
          SELECT MAX(d2.DOC_VRS) FROM TPRMPP_BRDOCM d2
          WHERE d2.DOC_MNG_NO = d.DOC_MNG_NO AND d2.DEL_YN = 'N'
      )
    ORDER BY d.FST_ENR_DTM DESC
    """, nativeQuery = true)
List<Brdocm> findLatestVersionsAll();
```

- [ ] **Step 5: 기존 메서드 유지 확인**

아래 메서드는 그대로 유지:
```java
boolean existsByDocMngNoAndDelYn(String docMngNo, String delYn);

@Query(value = "SELECT S_DOC.NEXTVAL FROM DUAL", nativeQuery = true)
Long getNextSequenceValue();
```

- [ ] **Step 6: 컴파일 확인**

```bash
cd it_backend && ./gradlew compileJava 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 7: 커밋**

```bash
git add it_backend/src/main/java/.../repository/ServiceRequestDocRepository.java
git commit -m "feat: ServiceRequestDocRepository 복합키 및 버전 조회 메서드 추가"
```

---

## Task 5: 서비스 단위 테스트 작성 (TDD — Red 단계)

**Files:**
- Create: `it_backend/src/test/java/com/example/it/domain/servicerequest/service/ServiceRequestDocServiceTest.java`

- [ ] **Step 1: 테스트 파일 생성**

패키지명은 실제 Service 클래스의 패키지를 따른다.

```java
package com.example.it.domain.servicerequest.service;

import com.example.it.domain.servicerequest.dto.ServiceRequestDocDto;
import com.example.it.domain.servicerequest.entity.Brdocm;
import com.example.it.domain.servicerequest.repository.ServiceRequestDocRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
class ServiceRequestDocServiceTest {

    @Mock
    ServiceRequestDocRepository repository;

    @InjectMocks
    ServiceRequestDocService service;

    @Test
    @DisplayName("신규 문서 생성 시 버전은 0.01 이다")
    void createDocument_setsInitialVersion() {
        // Arrange
        given(repository.getNextSequenceValue()).willReturn(1L);
        given(repository.existsByDocMngNoAndDelYn(anyString(), eq("N"))).willReturn(false);
        ServiceRequestDocDto.CreateRequest req = ServiceRequestDocDto.CreateRequest.builder()
            .reqNm("테스트 문서").build();
        Brdocm saved = Brdocm.builder()
            .docMngNo("DOC-001")
            .docVrs(new BigDecimal("0.01"))
            .reqNm("테스트 문서")
            .build();
        given(repository.save(any(Brdocm.class))).willReturn(saved);

        // Act
        String docMngNo = service.createDocument(req);

        // Assert
        then(repository).should().save(argThat(entity ->
            new BigDecimal("0.01").compareTo(entity.getDocVrs()) == 0
        ));
        assertThat(docMngNo).isNotBlank();
    }

    @Test
    @DisplayName("새 버전 생성 시 기존 최신 버전 + 0.01 로 생성된다")
    void createNewVersion_incrementsVersion() {
        // Arrange
        Brdocm latest = Brdocm.builder()
            .docMngNo("DOC-001")
            .docVrs(new BigDecimal("0.01"))
            .reqNm("문서")
            .build();
        given(repository.findTopByDocMngNoAndDelYnOrderByDocVrsDesc("DOC-001", "N"))
            .willReturn(Optional.of(latest));
        given(repository.save(any(Brdocm.class))).willAnswer(inv -> inv.getArgument(0));

        // Act
        BigDecimal newVersion = service.createNewVersion("DOC-001");

        // Assert
        assertThat(newVersion).isEqualByComparingTo(new BigDecimal("0.02"));
        then(repository).should().save(argThat(entity ->
            new BigDecimal("0.02").compareTo(entity.getDocVrs()) == 0
        ));
    }

    @Test
    @DisplayName("새 버전 생성 시 문서가 없으면 예외가 발생한다")
    void createNewVersion_throwsWhenNotFound() {
        // Arrange
        given(repository.findTopByDocMngNoAndDelYnOrderByDocVrsDesc("MISSING", "N"))
            .willReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> service.createNewVersion("MISSING"))
            .isInstanceOf(RuntimeException.class);
    }

    @Test
    @DisplayName("version 파라미터 없이 조회 시 최신 버전을 반환한다")
    void getDocument_withoutVersion_returnsLatest() {
        // Arrange
        Brdocm latest = Brdocm.builder()
            .docMngNo("DOC-001")
            .docVrs(new BigDecimal("0.03"))
            .reqNm("최신 문서")
            .build();
        given(repository.findTopByDocMngNoAndDelYnOrderByDocVrsDesc("DOC-001", "N"))
            .willReturn(Optional.of(latest));

        // Act
        ServiceRequestDocDto.Response result = service.getDocument("DOC-001", null);

        // Assert
        assertThat(result.getDocVrs()).isEqualByComparingTo(new BigDecimal("0.03"));
    }

    @Test
    @DisplayName("version 파라미터 지정 시 해당 버전을 반환한다")
    void getDocument_withVersion_returnsSpecific() {
        // Arrange
        Brdocm v1 = Brdocm.builder()
            .docMngNo("DOC-001")
            .docVrs(new BigDecimal("0.01"))
            .reqNm("v0.01 문서")
            .build();
        given(repository.findByDocMngNoAndDocVrsAndDelYn("DOC-001", new BigDecimal("0.01"), "N"))
            .willReturn(Optional.of(v1));

        // Act
        ServiceRequestDocDto.Response result = service.getDocument("DOC-001", new BigDecimal("0.01"));

        // Assert
        assertThat(result.getDocVrs()).isEqualByComparingTo(new BigDecimal("0.01"));
    }

    @Test
    @DisplayName("version 없이 삭제 시 전체 버전이 소프트 삭제된다")
    void deleteDocument_withoutVersion_deletesAll() {
        // Arrange
        Brdocm v1 = Brdocm.builder().docMngNo("DOC-001").docVrs(new BigDecimal("0.01")).build();
        Brdocm v2 = Brdocm.builder().docMngNo("DOC-001").docVrs(new BigDecimal("0.02")).build();
        given(repository.findAllByDocMngNoAndDelYn("DOC-001", "N")).willReturn(List.of(v1, v2));

        // Act
        service.deleteDocument("DOC-001", null);

        // Assert — Dirty Checking으로 save 미호출, delYn 변경 확인
        assertThat(v1.getDelYn()).isEqualTo("Y");
        assertThat(v2.getDelYn()).isEqualTo("Y");
    }
}
```

- [ ] **Step 2: 테스트 실행 — Red 확인**

```bash
cd it_backend && ./gradlew test --tests "*ServiceRequestDocServiceTest" 2>&1 | tail -30
```

Expected: FAIL (서비스 메서드가 아직 구현되지 않았으므로)

- [ ] **Step 3: 커밋 (Red 상태)**

```bash
git add it_backend/src/test/.../service/ServiceRequestDocServiceTest.java
git commit -m "test: ServiceRequestDocService 단위 테스트 추가 (Red)"
```

---

## Task 6: ServiceRequestDocService 수정 (TDD — Green 단계)

**Files:**
- Modify: `it_backend/src/main/java/com/example/it/domain/servicerequest/service/ServiceRequestDocService.java`

- [ ] **Step 1: 현재 Service 파일 읽기**

```bash
cat it_backend/src/main/java/.../service/ServiceRequestDocService.java
```

기존 메서드 구현을 파악한다 (`getDocumentList`, `getDocument`, `createDocument`, `updateDocument`, `deleteDocument`).

- [ ] **Step 2: getDocumentList() 수정**

```java
public List<ServiceRequestDocDto.Response> getDocumentList() {
    return repository.findLatestVersionsAll().stream()
        .map(ServiceRequestDocDto.Response::fromEntity)
        .collect(Collectors.toList());
}
```

- [ ] **Step 3: getDocument() 수정 — version 파라미터 추가**

```java
public ServiceRequestDocDto.Response getDocument(String docMngNo, BigDecimal version) {
    Brdocm entity;
    if (version == null) {
        entity = repository.findTopByDocMngNoAndDelYnOrderByDocVrsDesc(docMngNo, "N")
            .orElseThrow(() -> new EntityNotFoundException("문서를 찾을 수 없습니다: " + docMngNo));
    } else {
        entity = repository.findByDocMngNoAndDocVrsAndDelYn(docMngNo, version, "N")
            .orElseThrow(() -> new EntityNotFoundException("해당 버전의 문서를 찾을 수 없습니다: " + docMngNo + " v" + version));
    }
    return ServiceRequestDocDto.Response.fromEntity(entity);
}
```

- [ ] **Step 4: getVersionHistory() 신규 추가**

```java
public List<ServiceRequestDocDto.VersionResponse> getVersionHistory(String docMngNo) {
    return repository.findAllByDocMngNoAndDelYnOrderByDocVrsDesc(docMngNo, "N").stream()
        .map(ServiceRequestDocDto.VersionResponse::fromEntity)
        .collect(Collectors.toList());
}
```

- [ ] **Step 5: createDocument() 수정 — docVrs 주입**

```java
public String createDocument(ServiceRequestDocDto.CreateRequest request) {
    // 채번 로직 유지
    String docMngNo = generateDocMngNo(); // 기존 채번 로직
    BigDecimal initialVersion = new BigDecimal("0.01");
    Brdocm entity = request.toEntity(docMngNo, initialVersion);
    repository.save(entity);
    return docMngNo;
}
```

> 기존 채번 로직(`getNextSequenceValue()`, 중복 방지 루프 등)은 그대로 유지하고, `toEntity()` 호출부에만 `initialVersion` 파라미터를 추가한다.

- [ ] **Step 6: updateDocument() 수정 — findTop 사용**

```java
public void updateDocument(String docMngNo, ServiceRequestDocDto.UpdateRequest request) {
    Brdocm entity = repository.findTopByDocMngNoAndDelYnOrderByDocVrsDesc(docMngNo, "N")
        .orElseThrow(() -> new EntityNotFoundException("문서를 찾을 수 없습니다: " + docMngNo));
    entity.update(request); // 기존 update() 메서드 — 버전 변경 없음
}
```

- [ ] **Step 7: createNewVersion() 신규 추가**

```java
public BigDecimal createNewVersion(String docMngNo) {
    Brdocm latest = repository.findTopByDocMngNoAndDelYnOrderByDocVrsDesc(docMngNo, "N")
        .orElseThrow(() -> new EntityNotFoundException("문서를 찾을 수 없습니다: " + docMngNo));
    BigDecimal nextVrs = latest.getDocVrs().add(new BigDecimal("0.01"));
    Brdocm newEntity = latest.newVersion(nextVrs);
    repository.save(newEntity);
    return nextVrs;
}
```

- [ ] **Step 8: deleteDocument() 수정 — version 파라미터 추가**

```java
public void deleteDocument(String docMngNo, BigDecimal version) {
    if (version == null) {
        List<Brdocm> all = repository.findAllByDocMngNoAndDelYn(docMngNo, "N");
        if (all.isEmpty()) {
            throw new EntityNotFoundException("문서를 찾을 수 없습니다: " + docMngNo);
        }
        all.forEach(e -> e.softDelete()); // 기존 softDelete() or setDelYn("Y") 메서드
    } else {
        Brdocm entity = repository.findByDocMngNoAndDocVrsAndDelYn(docMngNo, version, "N")
            .orElseThrow(() -> new EntityNotFoundException("해당 버전의 문서를 찾을 수 없습니다: " + docMngNo + " v" + version));
        entity.softDelete();
    }
}
```

> `softDelete()` 또는 `setDelYn("Y")` — `Brdocm` 엔티티의 실제 삭제 메서드명을 Step 1에서 확인한 뒤 사용한다.

- [ ] **Step 9: 필요 import 추가**

```java
import jakarta.persistence.EntityNotFoundException;
import java.math.BigDecimal;
import java.util.List;
```

- [ ] **Step 10: 테스트 실행 — Green 확인**

```bash
cd it_backend && ./gradlew test --tests "*ServiceRequestDocServiceTest" 2>&1 | tail -30
```

Expected: 6/6 PASSED

- [ ] **Step 11: 커밋**

```bash
git add it_backend/src/main/java/.../service/ServiceRequestDocService.java
git commit -m "feat: ServiceRequestDocService 버전 관리 기능 구현"
```

---

## Task 7: ServiceRequestDocController 수정

**Files:**
- Modify: `it_backend/src/main/java/com/example/it/domain/servicerequest/controller/ServiceRequestDocController.java`

- [ ] **Step 1: 현재 Controller 파일 읽기**

```bash
cat it_backend/src/main/java/.../controller/ServiceRequestDocController.java
```

기존 엔드포인트 메서드 시그니처를 확인한다.

- [ ] **Step 2: getDocument() 수정 — version 쿼리파라미터 추가**

```java
@GetMapping("/{docMngNo}")
public ResponseEntity<ServiceRequestDocDto.Response> getDocument(
        @PathVariable String docMngNo,
        @RequestParam(required = false) BigDecimal version) {
    return ResponseEntity.ok(service.getDocument(docMngNo, version));
}
```

- [ ] **Step 3: getVersionHistory() 신규 추가**

```java
@GetMapping("/{docMngNo}/versions")
public ResponseEntity<List<ServiceRequestDocDto.VersionResponse>> getVersionHistory(
        @PathVariable String docMngNo) {
    return ResponseEntity.ok(service.getVersionHistory(docMngNo));
}
```

- [ ] **Step 4: createNewVersion() 신규 추가**

```java
@PostMapping("/{docMngNo}/versions")
public ResponseEntity<String> createNewVersion(@PathVariable String docMngNo) {
    BigDecimal newVrs = service.createNewVersion(docMngNo);
    return ResponseEntity.ok("새 버전이 생성되었습니다: v" + newVrs.toPlainString());
}
```

- [ ] **Step 5: deleteDocument() 수정 — version 쿼리파라미터 추가**

```java
@DeleteMapping("/{docMngNo}")
public ResponseEntity<Void> deleteDocument(
        @PathVariable String docMngNo,
        @RequestParam(required = false) BigDecimal version) {
    service.deleteDocument(docMngNo, version);
    return ResponseEntity.noContent().build();
}
```

- [ ] **Step 6: import 추가**

```java
import java.math.BigDecimal;
import java.util.List;
```

- [ ] **Step 7: 컴파일 확인**

```bash
cd it_backend && ./gradlew compileJava 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 8: 커밋**

```bash
git add it_backend/src/main/java/.../controller/ServiceRequestDocController.java
git commit -m "feat: ServiceRequestDocController 버전 관련 엔드포인트 추가"
```

---

## Task 8: 백엔드 전체 빌드 및 테스트

- [ ] **Step 1: 전체 테스트 실행**

```bash
cd it_backend && ./gradlew test 2>&1 | tail -30
```

Expected: `BUILD SUCCESSFUL`, 실패 테스트 0건

- [ ] **Step 2: 서버 기동 확인**

```bash
cd it_backend && ./gradlew bootRun &
# 30초 대기 후
curl -s http://localhost:8080/api/documents | head -50
```

Expected: JSON 응답 (빈 배열 또는 문서 목록)

- [ ] **Step 3: Swagger 확인**

브라우저에서 `http://localhost:8080/swagger-ui/index.html` 접속 후:
- `GET /api/documents/{docMngNo}` — `version` 쿼리파라미터 표시 확인
- `GET /api/documents/{docMngNo}/versions` 엔드포인트 표시 확인
- `POST /api/documents/{docMngNo}/versions` 엔드포인트 표시 확인

- [ ] **Step 4: 커밋**

```bash
git commit -m "chore: 백엔드 빌드 및 테스트 통과 확인"
```

---

## Task 9: useDocuments.ts 수정

**Files:**
- Modify: `it_frontend/app/composables/useDocuments.ts`

- [ ] **Step 1: 현재 파일 읽기**

```bash
cat it_frontend/app/composables/useDocuments.ts
```

`RequirementDocument` 인터페이스, `fetchDocument`, `deleteDocument` 함수 구조를 파악한다.

- [ ] **Step 2: RequirementDocument 타입에 docVrs 추가**

```typescript
interface RequirementDocument {
  docMngNo: string
  docVrs: number      // 신규 추가
  reqNm: string
  // ... 기존 필드 유지
}
```

- [ ] **Step 3: VersionSummary 타입 추가**

`RequirementDocument` 인터페이스 바로 아래에 추가:

```typescript
interface VersionSummary {
  docMngNo: string
  docVrs: number
  fstEnrDtm: string
  lstChgDtm: string
  delYn: string
}
```

- [ ] **Step 4: fetchDocument() — version 파라미터 추가**

```typescript
const fetchDocument = async (docMngNo: string, version?: number) => {
  const query = version !== undefined ? { version } : undefined
  const { data, error } = await useApiFetch<RequirementDocument>(
    `/api/documents/${docMngNo}`,
    { query }
  )
  if (error.value) throw error.value
  return data.value
}
```

- [ ] **Step 5: fetchVersionHistory() 신규 추가**

```typescript
const fetchVersionHistory = async (docMngNo: string): Promise<VersionSummary[]> => {
  const { data, error } = await useApiFetch<VersionSummary[]>(
    `/api/documents/${docMngNo}/versions`
  )
  if (error.value) throw error.value
  return data.value ?? []
}
```

- [ ] **Step 6: createNewVersion() 신규 추가**

```typescript
const createNewVersion = async (docMngNo: string): Promise<string> => {
  return await $apiFetch<string>(`/api/documents/${docMngNo}/versions`, {
    method: 'POST'
  })
}
```

- [ ] **Step 7: deleteDocument() — version 파라미터 추가**

```typescript
const deleteDocument = async (docMngNo: string, version?: number) => {
  const query = version !== undefined ? { version } : undefined
  await $apiFetch(`/api/documents/${docMngNo}`, {
    method: 'DELETE',
    query
  })
}
```

- [ ] **Step 8: return 문에 신규 함수 추가**

```typescript
return {
  // ... 기존 반환값
  fetchVersionHistory,
  createNewVersion,
}
```

- [ ] **Step 9: 타입 체크**

```bash
cd it_frontend && npx nuxt typecheck 2>&1 | tail -20
```

Expected: 오류 0건

- [ ] **Step 10: 커밋**

```bash
git add it_frontend/app/composables/useDocuments.ts
git commit -m "feat: useDocuments 버전 관련 타입 및 함수 추가"
```

---

## Task 10: 목록 페이지(index.vue) 수정

**Files:**
- Modify: `it_frontend/app/pages/info/documents/index.vue`

- [ ] **Step 1: 현재 파일 읽기**

```bash
cat it_frontend/app/pages/info/documents/index.vue
```

`DataTable`의 `data-key` 속성과 컬럼 구조를 파악한다.

- [ ] **Step 2: data-key 변경**

```vue
<!-- 변경 전 -->
<DataTable data-key="docMngNo" ...>

<!-- 변경 후 -->
<DataTable :data-key="(row) => `${row.docMngNo}_${row.docVrs}`" ...>
```

- [ ] **Step 3: 버전 컬럼 추가**

`문서번호` 컬럼 바로 뒤에 버전 컬럼 추가:

```vue
<Column field="docVrs" header="버전" style="text-align: center; width: 80px">
  <template #body="{ data }">
    v{{ Number(data.docVrs).toFixed(2) }}
  </template>
</Column>
```

- [ ] **Step 4: 타입 체크 및 개발 서버 확인**

```bash
cd it_frontend && npx nuxt typecheck 2>&1 | tail -10
```

개발 서버(`npm run dev`)가 실행 중이면 `http://localhost:3000/info/documents`에서 버전 컬럼 표시를 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/pages/info/documents/index.vue
git commit -m "feat: 문서 목록 버전 컬럼 추가"
```

---

## Task 11: 상세 페이지([id]/index.vue) 수정

**Files:**
- Modify: `it_frontend/app/pages/info/documents/[id]/index.vue`

- [ ] **Step 1: 현재 파일 읽기**

```bash
cat it_frontend/app/pages/info/documents/\[id\]/index.vue
```

`useRoute`, `fetchDocument`, 기존 `script setup` 상단 구조를 파악한다.

- [ ] **Step 2: script setup — 버전 쿼리파라미터 처리 추가**

기존 `const route = useRoute()` 아래에 추가:

```typescript
const versionQuery = computed(() =>
  route.query.version ? Number(route.query.version) : undefined
)

const { fetchDocument, fetchVersionHistory, createNewVersion } = useDocuments()

const versions = ref<VersionSummary[]>([])
const isHistoricalVersion = computed(() =>
  versionQuery.value !== undefined
)
```

- [ ] **Step 3: fetchDocument 호출부 수정**

기존 `fetchDocument(docMngNo)` 호출을 아래로 변경:

```typescript
const document = await fetchDocument(docMngNo, versionQuery.value)
versions.value = await fetchVersionHistory(docMngNo)
```

- [ ] **Step 4: createNewVersion 핸들러 추가**

```typescript
const onCreateNewVersion = async () => {
  try {
    await createNewVersion(docMngNo)
    await navigateTo(`/info/documents/${docMngNo}`)
  } catch (e) {
    console.error(e)
  }
}
```

- [ ] **Step 5: 템플릿 — 버전 배지 및 "새 버전으로 저장" 버튼 추가**

문서 제목/헤더 영역에 추가:

```vue
<Tag :value="`v${Number(document.docVrs).toFixed(2)}`" severity="info" class="ml-2" />
```

수정 버튼 그룹 옆에 "새 버전으로 저장" 버튼 추가:

```vue
<Button
  v-if="!isHistoricalVersion"
  label="새 버전으로 저장"
  icon="pi pi-copy"
  severity="secondary"
  @click="onCreateNewVersion"
/>
```

- [ ] **Step 6: 템플릿 — 과거 버전 읽기 전용 배너 추가**

페이지 상단(헤더 아래)에 추가:

```vue
<Message v-if="isHistoricalVersion" severity="warn" :closable="false" class="mb-4">
  이전 버전(v{{ versionQuery?.toFixed(2) }})을 보고 있습니다. 수정하려면 최신 버전을 조회하세요.
</Message>
```

편집/삭제 버튼에 `:disabled="isHistoricalVersion"` 추가.

- [ ] **Step 7: 템플릿 — 버전 히스토리 사이드바 패널 추가**

페이지 우측 혹은 하단에 버전 목록 패널 추가:

```vue
<Panel header="버전 히스토리" class="mt-4">
  <ul class="list-none p-0 m-0">
    <li
      v-for="v in versions"
      :key="`${v.docMngNo}_${v.docVrs}`"
      class="flex align-items-center justify-content-between py-2 border-bottom-1 surface-border cursor-pointer"
      :class="{ 'font-bold text-primary': Number(v.docVrs) === (versionQuery ?? document.docVrs) }"
      @click="navigateTo(`/info/documents/${v.docMngNo}?version=${v.docVrs}`)"
    >
      <span>v{{ Number(v.docVrs).toFixed(2) }}</span>
      <span class="text-sm text-500">{{ v.lstChgDtm }}</span>
    </li>
  </ul>
</Panel>
```

- [ ] **Step 8: import 보완**

`VersionSummary` 타입이 `useDocuments`에서 export되는지 확인. 안 되면 export 추가.

- [ ] **Step 9: 타입 체크**

```bash
cd it_frontend && npx nuxt typecheck 2>&1 | tail -20
```

Expected: 오류 0건

- [ ] **Step 10: 커밋**

```bash
git add "it_frontend/app/pages/info/documents/[id]/index.vue"
git commit -m "feat: 문서 상세 버전 배지·새 버전 버튼·히스토리 패널 추가"
```

---

## Task 12: 프론트엔드 빌드 및 통합 확인

- [ ] **Step 1: 프론트엔드 빌드 확인**

```bash
cd it_frontend && npm run build 2>&1 | tail -20
```

Expected: 오류 없이 빌드 완료

- [ ] **Step 2: 통합 동작 확인 (두 서버 모두 기동 상태)**

1. `http://localhost:3000/info/documents` 접속 → `버전` 컬럼 표시 확인
2. 임의 문서 클릭 → 상세 페이지에서 버전 배지(`v0.01`) 확인
3. "새 버전으로 저장" 버튼 클릭 → 새 버전 생성 후 페이지 갱신 확인
4. 버전 히스토리 패널에서 이전 버전 클릭 → URL `?version=0.01` 이동, 읽기 전용 배너 표시 확인
5. 목록 페이지로 돌아가 최신 버전만 표시되는지 확인

- [ ] **Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat: BRDOCM 문서버전(DOC_VRS) 복합키 전 레이어 구현 완료"
```

---

## 주의 사항

1. **실제 파일 경로**: 위 경로는 설계 기준이다. 각 태스크 Step 1에서 `find` 명령으로 실제 경로를 확인하고 조정한다.
2. **Oracle Sequence 이름**: `S_DOC.NEXTVAL` — 실제 시퀀스 이름이 다를 경우 Repository에서 확인 후 수정한다.
3. **softDelete() 메서드**: `Brdocm` 또는 `BaseEntity`의 실제 삭제 처리 메서드명을 확인 후 사용한다.
4. **VersionSummary export**: `useDocuments.ts`에서 `VersionSummary` 인터페이스를 export해야 상세 페이지에서 타입을 사용할 수 있다.
5. **BigDecimal 정밀도**: `0.01 + 0.01 = 0.02` — `BigDecimal.add()`는 정확하나, `ROUND_HALF_UP` 스케일 설정이 필요한 경우 `.setScale(2, RoundingMode.HALF_UP)` 추가.
