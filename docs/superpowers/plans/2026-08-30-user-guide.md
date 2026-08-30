# 사용자가이드 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 `/admin/user-guides`에서 사용자가이드 파일을 올리고 교체하면, 헤더 [통합검색] 좌측 [사용자가이드] 버튼으로 전 직원이 내려받을 수 있게 한다.

**Architecture:** 전용 테이블을 만들지 않고 공통첨부파일기본(`TPRMPP_CFILEM`)을 재사용한다. 서버가 `APG_FL_KD_NM='사용자가이드'` / `APG_FL_LNK_CTZ_NM='HEADER'` / `FL_TP_CONE='첨부파일'`을 고정하고, `DEL_YN`으로 현재 가이드(`N`)와 이력(`Y`)을 구분한다. `/info` 홈 배너(`BannerService`·`/admin/banners`)가 같은 구조로 이미 동작하므로 그 흐름을 따른다. 내려받기는 새 엔드포인트 없이 읽기 판정기 하나를 추가해 기존 `GET /api/files/{flMpnId}/download`를 쓴다.

**Tech Stack:** Spring Boot(Java 21, JPA, springdoc) · Nuxt 4 CSR(Vue 3 Composition API, PrimeVue, vue-i18n, Vitest) · Oracle + Flyway

**Spec:** `docs/superpowers/specs/2026-08-30-user-guide-design.md`

## Global Constraints

- 저장소가 셋(`it_backend`·`it_frontend`·`it_database`)이며 각각 독립 git 저장소다. 커밋은 **해당 저장소 디렉터리 안에서** 하고, `git add -A`·`git add .`·`git commit -a`를 쓰지 않고 **경로를 명시**한다.
- 워킹트리는 다른 작업과 공유한다. 자기 변경만 스테이징하고 남의 변경을 되돌리지 않는다. 커밋 전 `git diff --cached --stat`과 `git rev-parse --abbrev-ref HEAD`를 확인한다.
- 신규 JavaDoc·TSDoc·주석은 한글로 쓴다. 자명한 대입에는 주석을 달지 않는다.
- 파일 종류 문자열은 정확히 `사용자가이드`, 부모 키는 정확히 `HEADER`, 파일유형내용은 `첨부파일`이다.
- 허용 확장자: `pdf`, `hwp`, `hwpx`, `docx`, `pptx` (소문자로 변환해 비교, 대소문자 무시).
- 활성 불변식: `APG_FL_KD_NM='사용자가이드'`이면서 `DEL_YN='N'`인 행은 항상 0건 또는 1건.
- 관리자 권한 ID는 `ITPAD001`, Spring 롤은 `ROLE_ADMIN`.
- 생성 타입(`it_frontend`의 OpenAPI codegen 산출물)은 수기로 편집하지 않는다.
- 적용된 Flyway 스크립트는 수정하지 않는다. 신규 버전은 `V20260830_003`을 쓴다(`_001`은 다른 작업이 선점한 untracked 파일, `_002`는 이미 커밋·적용된 `SeedSpeedDialBoardTypes`).

---

## File Structure

**it_backend**

- 생성 `src/main/java/com/kdb/it/infra/file/authz/UserGuideFileReadAuthorizer.java` — 종류 `사용자가이드`의 읽기 판정(전사 공개). `FileKindRegistry`가 이 선언을 읽어 종류를 인식하므로 업로드 허용의 관문이기도 하다.
- 생성 `src/main/java/com/kdb/it/domain/userguide/dto/UserGuideDto.java` — `Response`, `ActiveRequest`
- 생성 `src/main/java/com/kdb/it/domain/userguide/service/UserGuideService.java` — 규약 고정·교체 불변식·확장자·종류 봉인
- 생성 `src/main/java/com/kdb/it/domain/userguide/controller/UserGuideController.java` — 권한 경계와 HTTP 계약

**it_frontend**

- 생성 `app/composables/useUserGuide.ts` — 4개 엔드포인트 래퍼와 내려받기
- 생성 `app/components/layout/UserGuideButton.vue` — 헤더 버튼(4상태). `AppHeader.vue`가 이미 커서 분리한다.
- 수정 `app/components/layout/AppHeader.vue` — 우측 영역 `<GlobalSearchBar />` 바로 앞에 버튼 삽입
- 생성 `app/pages/admin/user-guides.vue` — 관리 화면
- 수정 `i18n/messages/layout.ts` — `layout.header.userGuide.*` (ko·en)
- 수정 `i18n/messages/admin.ts` — `admin.userGuides.*` (ko·en)

**it_database**

- 생성 `migrations/V20260830_003__SeedUserGuideAdminMenu.sql`
- 생성 `migrations/_verify/user-guide-menu-seed-verify.sql`

`app/utils/menuPresentation.ts`의 `MENU_ICON_OPTIONS`에는 `pi pi-book`이 **이미 있으므로 수정하지 않는다.**

---

## Task 1: 사용자가이드 읽기 판정기

**Files:**

- Create: `it_backend/src/main/java/com/kdb/it/infra/file/authz/UserGuideFileReadAuthorizer.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/authz/UserGuideFileReadAuthorizerTest.java`

**Interfaces:**

- Consumes: `FileReadAuthorizer` 인터페이스 — `Set<String> supportedApgFlKdNms()`, `boolean canRead(Cfilem file, CustomUserDetails user)`
- Produces: `UserGuideFileReadAuthorizer.USER_GUIDE_KIND` (`public static final String`, 값 `"사용자가이드"`). Task 2가 이 상수를 import 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`it_backend/src/test/java/com/kdb/it/infra/file/authz/UserGuideFileReadAuthorizerTest.java`:

```java
package com.kdb.it.infra.file.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class UserGuideFileReadAuthorizerTest {

    private final UserGuideFileReadAuthorizer authorizer = new UserGuideFileReadAuthorizer();

    @Test
    @DisplayName("사용자가이드 종류를 담당한다")
    void supports_userGuide() {
        assertThat(authorizer.supportedApgFlKdNms()).containsExactly("사용자가이드");
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

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests '*UserGuideFileReadAuthorizerTest' --no-daemon
```

기대: 컴파일 실패 — `UserGuideFileReadAuthorizer` 심볼을 찾을 수 없음.

- [ ] **Step 3: 최소 구현 작성**

`it_backend/src/main/java/com/kdb/it/infra/file/authz/UserGuideFileReadAuthorizer.java`:

```java
package com.kdb.it.infra.file.authz;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 사용자가이드 첨부 읽기 판정기 — 전사 공개(인증 사용자 전체).
 *
 * <p>사용자가이드는 헤더에서 전 직원이 내려받는 포털 매뉴얼이므로 인증된 사용자에게 읽기를 허용한다.
 * (default-deny의 명시적 예외)
 *
 * <p>이 선언이 {@link FileKindRegistry}가 종류 {@code 사용자가이드}를 아는 유일한 근거이기도 하다. 판정기를
 * 지우면 업로드 자체가 막힌다.
 */
@Component
public class UserGuideFileReadAuthorizer implements FileReadAuthorizer {

    /** 사용자가이드 파일 종류(APG_FL_KD_NM). */
    public static final String USER_GUIDE_KIND = "사용자가이드";

    @Override
    public Set<String> supportedApgFlKdNms() {
        return Set.of(USER_GUIDE_KIND);
    }

    @Override
    public boolean canRead(Cfilem file, CustomUserDetails user) {
        return user != null; // 전사 공개: 인증 사용자 전체
    }
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests '*UserGuideFileReadAuthorizerTest' --no-daemon
```

기대: 3 tests PASS.

- [ ] **Step 5: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/infra/file/authz/UserGuideFileReadAuthorizer.java src/test/java/com/kdb/it/infra/file/authz/UserGuideFileReadAuthorizerTest.java && git diff --cached --stat && git commit -m "feat: 사용자가이드 첨부 읽기 판정기 추가"
```

---

## Task 2: UserGuideDto와 UserGuideService

**Files:**

- Create: `it_backend/src/main/java/com/kdb/it/domain/userguide/dto/UserGuideDto.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/userguide/service/UserGuideService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/userguide/service/UserGuideServiceTest.java`

**Interfaces:**

- Consumes:
  - `UserGuideFileReadAuthorizer.USER_GUIDE_KIND` (Task 1)
  - `FileService.uploadFileAndGet(MultipartFile file, FileDto.UploadRequest request)` → `FileDto.Response` (게터 `getFlMpnId`, `getFlNm`, `getApgFlSz`, `getFstEnrDtm`, `getFstEnrUsid`)
  - `FileDto.UploadRequest.builder().flTpCone(..).apgFlKdNm(..).apgFlLnkCtzNm(..).build()`
  - `FileRepository.findAllByApgFlKdNmAndApgFlLnkCtzNmAndDelYn(String, String, String)` → `List<Cfilem>`
  - `FileRepository.findAllByApgFlKdNmAndApgFlLnkCtzNmOrderByFlMpnIdAsc(String, String)` → `List<Cfilem>`
  - `FileRepository.findById(String)` → `Optional<Cfilem>`
  - `Cfilem.delete()` / `Cfilem.restore()` / `Cfilem.getDelYn()`
- Produces:
  - `UserGuideDto.Response` — Lombok `@Builder`, 게터 `getFlMpnId()`, `getFlNm()`, `getApgFlSz()`, `isActive()`, `getDownloadUrl()`, `getFstEnrDtm()`, `getFstEnrUsid()`
  - `UserGuideDto.ActiveRequest` — 게터 `getActive()` (`Boolean`, `@NotNull`)
  - `UserGuideService.USER_GUIDE_APG_FL_LNK_CTZ_NM` = `"HEADER"`
  - `UserGuideService.getActiveGuide()` → `Optional<UserGuideDto.Response>`
  - `UserGuideService.getAllGuides()` → `List<UserGuideDto.Response>`
  - `UserGuideService.upload(MultipartFile)` → `UserGuideDto.Response`
  - `UserGuideService.setActive(String flMpnId, boolean active)` → `UserGuideDto.Response`

- [ ] **Step 1: DTO 작성 (테스트가 컴파일되려면 먼저 필요하다)**

`it_backend/src/main/java/com/kdb/it/domain/userguide/dto/UserGuideDto.java`:

```java
package com.kdb.it.domain.userguide.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 사용자가이드 API 요청·응답 DTO 모음 */
public class UserGuideDto {

    private UserGuideDto() {}

    /** 사용자가이드 조회 응답 DTO */
    @Schema(name = "UserGuideDto.Response", description = "사용자가이드 조회 응답 DTO")
    @Getter
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Response {

        @Schema(description = "파일매핑ID", example = "FL-00000001")
        private String flMpnId;

        @Schema(description = "파일명", example = "IT포털 사용자가이드 v1.2.pdf")
        private String flNm;

        @Schema(description = "첨부파일크기(바이트). 레거시 파일은 null", example = "3145728")
        private Long apgFlSz;

        @Schema(description = "현재 가이드 여부 (DEL_YN='N'이면 true)", example = "true")
        private boolean active;

        @Schema(description = "내려받기 URL", example = "/api/files/FL-00000001/download")
        private String downloadUrl;

        @Schema(description = "최초등록일시")
        private LocalDateTime fstEnrDtm;

        @Schema(description = "최초등록자 사번", example = "EMP0001234")
        private String fstEnrUsid;
    }

    /** 사용자가이드 활성 상태 변경 요청 DTO */
    @Schema(name = "UserGuideDto.ActiveRequest", description = "사용자가이드 활성 상태 변경 요청 DTO")
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActiveRequest {

        @Schema(
                description = "현재 가이드로 지정할지 여부. true면 DEL_YN='N', false면 'Y'",
                example = "true",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "활성 여부(active)는 필수입니다.")
        private Boolean active;
    }
}
```

- [ ] **Step 2: 실패하는 서비스 테스트 작성**

`it_backend/src/test/java/com/kdb/it/domain/userguide/service/UserGuideServiceTest.java`:

```java
package com.kdb.it.domain.userguide.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.kdb.it.domain.userguide.dto.UserGuideDto;
import com.kdb.it.exception.CustomGeneralException;
import com.kdb.it.infra.file.dto.FileDto;
import com.kdb.it.infra.file.entity.Cfilem;
import com.kdb.it.infra.file.repository.FileRepository;
import com.kdb.it.infra.file.service.FileService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class UserGuideServiceTest {

    private static final String KIND = "사용자가이드";
    private static final String LINK = "HEADER";

    @Mock private FileService fileService;
    @Mock private FileRepository fileRepository;

    @InjectMocks private UserGuideService userGuideService;

    /** delYn을 지정해 사용자가이드 Cfilem 스텁을 만든다. */
    private Cfilem guide(String flMpnId, String delYn) {
        Cfilem file =
                Cfilem.builder()
                        .flMpnId(flMpnId)
                        .flNm(flMpnId + ".pdf")
                        .flTpCone("첨부파일")
                        .apgFlSz(2048L)
                        .apgFlKdNm(KIND)
                        .apgFlLnkCtzNm(LINK)
                        .build();
        if ("Y".equals(delYn)) {
            file.delete();
        } else {
            file.restore();
        }
        return file;
    }

    private MockMultipartFile document(String name) {
        return new MockMultipartFile("file", name, "application/pdf", "guide".getBytes());
    }

    @Test
    @DisplayName("현재 가이드가 없으면 빈 Optional을 반환한다")
    void getActiveGuide_empty() {
        given(fileRepository.findAllByApgFlKdNmAndApgFlLnkCtzNmAndDelYn(KIND, LINK, "N"))
                .willReturn(List.of());

        assertThat(userGuideService.getActiveGuide()).isEmpty();
    }

    @Test
    @DisplayName("현재 가이드를 내려받기 URL과 함께 반환한다")
    void getActiveGuide_present() {
        given(fileRepository.findAllByApgFlKdNmAndApgFlLnkCtzNmAndDelYn(KIND, LINK, "N"))
                .willReturn(List.of(guide("FL-00000007", "N")));

        UserGuideDto.Response result = userGuideService.getActiveGuide().orElseThrow();

        assertThat(result.getFlMpnId()).isEqualTo("FL-00000007");
        assertThat(result.isActive()).isTrue();
        assertThat(result.getDownloadUrl()).isEqualTo("/api/files/FL-00000007/download");
    }

    @Test
    @DisplayName("관리 목록은 이력을 포함해 파일매핑ID 내림차순(최신 우선)으로 반환한다")
    void getAllGuides_descending() {
        given(fileRepository.findAllByApgFlKdNmAndApgFlLnkCtzNmOrderByFlMpnIdAsc(KIND, LINK))
                .willReturn(List.of(guide("FL-00000001", "Y"), guide("FL-00000002", "N")));

        List<UserGuideDto.Response> result = userGuideService.getAllGuides();

        assertThat(result)
                .extracting(UserGuideDto.Response::getFlMpnId)
                .containsExactly("FL-00000002", "FL-00000001");
        assertThat(result.get(0).isActive()).isTrue();
        assertThat(result.get(1).isActive()).isFalse();
    }

    @Test
    @DisplayName("업로드하면 기존 현재 가이드를 내리고 종류·부모 키·파일유형을 서버가 고정한다")
    void upload_replacesPreviousActive() {
        Cfilem previous = guide("FL-00000001", "N");
        given(fileRepository.findAllByApgFlKdNmAndApgFlLnkCtzNmAndDelYn(KIND, LINK, "N"))
                .willReturn(List.of(previous));
        given(fileService.uploadFileAndGet(any(), any()))
                .willReturn(
                        FileDto.Response.builder()
                                .flMpnId("FL-00000002")
                                .flNm("guide.pdf")
                                .apgFlSz(2048L)
                                .build());

        UserGuideDto.Response result = userGuideService.upload(document("guide.pdf"));

        assertThat(previous.getDelYn()).isEqualTo("Y");
        assertThat(result.isActive()).isTrue();
        assertThat(result.getDownloadUrl()).isEqualTo("/api/files/FL-00000002/download");

        ArgumentCaptor<FileDto.UploadRequest> captor =
                ArgumentCaptor.forClass(FileDto.UploadRequest.class);
        verify(fileService).uploadFileAndGet(any(), captor.capture());
        assertThat(captor.getValue().getApgFlKdNm()).isEqualTo(KIND);
        assertThat(captor.getValue().getApgFlLnkCtzNm()).isEqualTo(LINK);
        assertThat(captor.getValue().getFlTpCone()).isEqualTo("첨부파일");
    }

    @Test
    @DisplayName("허용 확장자 밖이면 업로드를 거부한다")
    void upload_rejectsDisallowedExtension() {
        assertThatThrownBy(() -> userGuideService.upload(document("guide.exe")))
                .isInstanceOf(CustomGeneralException.class)
                .hasMessageContaining("pdf");
    }

    @Test
    @DisplayName("확장자 비교는 대소문자를 무시한다")
    void upload_allowsUppercaseExtension() {
        given(fileRepository.findAllByApgFlKdNmAndApgFlLnkCtzNmAndDelYn(KIND, LINK, "N"))
                .willReturn(List.of());
        given(fileService.uploadFileAndGet(any(), any()))
                .willReturn(FileDto.Response.builder().flMpnId("FL-00000003").build());

        assertThat(userGuideService.upload(document("GUIDE.PDF")).isActive()).isTrue();
    }

    @Test
    @DisplayName("되돌리기는 다른 현재 가이드를 먼저 내려 활성 1건을 유지한다")
    void setActive_true_keepsSingleActive() {
        Cfilem current = guide("FL-00000002", "N");
        Cfilem history = guide("FL-00000001", "Y");
        given(fileRepository.findById("FL-00000001")).willReturn(Optional.of(history));
        given(fileRepository.findAllByApgFlKdNmAndApgFlLnkCtzNmAndDelYn(KIND, LINK, "N"))
                .willReturn(List.of(current));

        UserGuideDto.Response result = userGuideService.setActive("FL-00000001", true);

        assertThat(current.getDelYn()).isEqualTo("Y");
        assertThat(history.getDelYn()).isEqualTo("N");
        assertThat(result.isActive()).isTrue();
    }

    @Test
    @DisplayName("현재 가이드를 내리면 활성 0건이 된다")
    void setActive_false_deactivates() {
        Cfilem current = guide("FL-00000002", "N");
        given(fileRepository.findById("FL-00000002")).willReturn(Optional.of(current));

        UserGuideDto.Response result = userGuideService.setActive("FL-00000002", false);

        assertThat(current.getDelYn()).isEqualTo("Y");
        assertThat(result.isActive()).isFalse();
    }

    @Test
    @DisplayName("사용자가이드가 아닌 파일은 이 API로 변경할 수 없다")
    void setActive_rejectsOtherKind() {
        Cfilem banner =
                Cfilem.builder()
                        .flMpnId("FL-00000009")
                        .apgFlKdNm("배너")
                        .apgFlLnkCtzNm("/info")
                        .build();
        given(fileRepository.findById("FL-00000009")).willReturn(Optional.of(banner));

        assertThatThrownBy(() -> userGuideService.setActive("FL-00000009", true))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("없는 파일매핑ID는 거부한다")
    void setActive_rejectsMissingFile() {
        given(fileRepository.findById("FL-99999999")).willReturn(Optional.empty());

        assertThatThrownBy(() -> userGuideService.setActive("FL-99999999", true))
                .isInstanceOf(CustomGeneralException.class);
    }
}
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests '*UserGuideServiceTest' --no-daemon
```

기대: 컴파일 실패 — `UserGuideService` 심볼을 찾을 수 없음.

- [ ] **Step 4: 서비스 구현**

`it_backend/src/main/java/com/kdb/it/domain/userguide/service/UserGuideService.java`:

```java
package com.kdb.it.domain.userguide.service;

import com.kdb.it.domain.userguide.dto.UserGuideDto;
import com.kdb.it.exception.CustomGeneralException;
import com.kdb.it.infra.file.authz.UserGuideFileReadAuthorizer;
import com.kdb.it.infra.file.dto.FileDto;
import com.kdb.it.infra.file.entity.Cfilem;
import com.kdb.it.infra.file.repository.FileRepository;
import com.kdb.it.infra.file.service.FileService;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 사용자가이드 서비스
 *
 * <p>사용자가이드는 전용 테이블 없이 공통첨부파일기본(TPRMPP_CFILEM)을 재사용한다. 이 서비스가 {@code
 * APG_FL_KD_NM='사용자가이드'}·{@code APG_FL_LNK_CTZ_NM='HEADER'}·{@code FL_TP_CONE='첨부파일'} 규약을
 * 강제하므로 클라이언트가 임의 값을 보낼 수 없다.
 *
 * <p><b>단일 파일 교체 방식</b>: {@code DEL_YN='N'}인 행은 항상 0건 또는 1건이다. 업로드와 되돌리기 모두 같은
 * 트랜잭션에서 기존 활성 행을 먼저 내린다. 이전 파일은 이력으로 남고 물리 파일은 어느 쪽에서도 지우지 않는다.
 */
@Service
@RequiredArgsConstructor
public class UserGuideService {

    /** 사용자가이드 노출 위치 — 헤더는 특정 화면이 아니라 전역이므로 경로 대신 위치명을 쓴다. */
    public static final String USER_GUIDE_APG_FL_LNK_CTZ_NM = "HEADER";

    private static final String ATTACHMENT_FL_TP_CONE = "첨부파일";
    private static final String ACTIVE = "N";

    /** 사용자가이드로 허용하는 확장자. 공통 FileValidator는 이미지·압축도 통과시키므로 여기서 좁힌다. */
    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of("pdf", "hwp", "hwpx", "docx", "pptx");

    private final FileService fileService;
    private final FileRepository fileRepository;

    /**
     * 헤더 버튼에 노출할 현재 사용자가이드를 조회합니다.
     *
     * @return 현재 가이드. 등록된 가이드가 없으면 빈 Optional
     */
    @Transactional(readOnly = true)
    public Optional<UserGuideDto.Response> getActiveGuide() {
        return activeGuides().stream()
                .max(Comparator.comparing(Cfilem::getFlMpnId))
                .map(file -> toResponse(file, true));
    }

    /**
     * 관리 화면용으로 현재 가이드와 이력을 모두 조회합니다.
     *
     * @return 파일매핑ID 내림차순(최신 우선) 전체 목록
     */
    @Transactional(readOnly = true)
    public List<UserGuideDto.Response> getAllGuides() {
        return fileRepository
                .findAllByApgFlKdNmAndApgFlLnkCtzNmOrderByFlMpnIdAsc(
                        UserGuideFileReadAuthorizer.USER_GUIDE_KIND, USER_GUIDE_APG_FL_LNK_CTZ_NM)
                .stream()
                .sorted(Comparator.comparing(Cfilem::getFlMpnId).reversed())
                .map(file -> toResponse(file, ACTIVE.equals(file.getDelYn())))
                .toList();
    }

    /**
     * 사용자가이드를 업로드하고 현재 가이드로 지정합니다.
     *
     * <p>기존 현재 가이드는 같은 트랜잭션에서 이력으로 내려간다.
     *
     * @param file 업로드할 가이드 파일
     * @return 업로드된 가이드 정보 (현재 가이드 상태)
     * @throws CustomGeneralException 확장자가 없거나 허용 목록 밖인 경우
     */
    @Transactional
    public UserGuideDto.Response upload(MultipartFile file) {
        requireAllowedExtension(file.getOriginalFilename());
        deactivateAllActive();

        FileDto.Response uploaded =
                fileService.uploadFileAndGet(
                        file,
                        FileDto.UploadRequest.builder()
                                .flTpCone(ATTACHMENT_FL_TP_CONE)
                                .apgFlKdNm(UserGuideFileReadAuthorizer.USER_GUIDE_KIND)
                                .apgFlLnkCtzNm(USER_GUIDE_APG_FL_LNK_CTZ_NM)
                                .build());

        return UserGuideDto.Response.builder()
                .flMpnId(uploaded.getFlMpnId())
                .flNm(uploaded.getFlNm())
                .apgFlSz(uploaded.getApgFlSz())
                .active(true)
                .downloadUrl(downloadUrl(uploaded.getFlMpnId()))
                .fstEnrDtm(uploaded.getFstEnrDtm())
                .fstEnrUsid(uploaded.getFstEnrUsid())
                .build();
    }

    /**
     * 사용자가이드를 현재 가이드로 지정하거나 내립니다.
     *
     * @param flMpnId 대상 파일매핑ID
     * @param active {@code true}면 다른 활성 건을 내린 뒤 이 건을 현재 가이드로, {@code false}면 이 건을 내린다
     * @return 변경된 가이드 정보
     * @throws CustomGeneralException 해당 파일매핑ID가 없는 경우
     * @throws AccessDeniedException 대상이 사용자가이드가 아닌 경우
     */
    @Transactional
    public UserGuideDto.Response setActive(String flMpnId, boolean active) {
        Cfilem file = requireUserGuideFile(flMpnId);

        if (active) {
            deactivateAllActive();
            file.restore();
        } else {
            file.delete();
        }
        return toResponse(file, active);
    }

    /** 현재 활성 상태인 사용자가이드 행을 모두 조회한다. 불변식상 0건 또는 1건이다. */
    private List<Cfilem> activeGuides() {
        return fileRepository.findAllByApgFlKdNmAndApgFlLnkCtzNmAndDelYn(
                UserGuideFileReadAuthorizer.USER_GUIDE_KIND, USER_GUIDE_APG_FL_LNK_CTZ_NM, ACTIVE);
    }

    /** 활성 행을 모두 내려 "활성 1건 이하" 불변식을 유지한다. 과거에 활성이 여러 건 생겼더라도 여기서 수렴한다. */
    private void deactivateAllActive() {
        activeGuides().forEach(Cfilem::delete);
    }

    /** 파일매핑ID로 사용자가이드 파일을 조회한다. DEL_YN과 무관하게 조회하며 종류가 다르면 거부한다. */
    private Cfilem requireUserGuideFile(String flMpnId) {
        Cfilem file =
                fileRepository
                        .findById(flMpnId)
                        .orElseThrow(
                                () ->
                                        new CustomGeneralException(
                                                "사용자가이드를 찾을 수 없습니다: " + flMpnId));

        if (!UserGuideFileReadAuthorizer.USER_GUIDE_KIND.equals(file.getApgFlKdNm())) {
            throw new AccessDeniedException("사용자가이드가 아닌 파일은 사용자가이드 API로 조회·변경할 수 없습니다.");
        }
        return file;
    }

    /** 확장자가 허용 목록에 있는지 검증한다. */
    private void requireAllowedExtension(String originalFilename) {
        int dot = originalFilename == null ? -1 : originalFilename.lastIndexOf('.');
        String extension =
                dot < 0 ? "" : originalFilename.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new CustomGeneralException(
                    "사용자가이드는 문서 파일만 등록할 수 있습니다. 허용 확장자: pdf, hwp, hwpx, docx, pptx");
        }
    }

    private UserGuideDto.Response toResponse(Cfilem file, boolean active) {
        return UserGuideDto.Response.builder()
                .flMpnId(file.getFlMpnId())
                .flNm(file.getFlNm())
                .apgFlSz(file.getApgFlSz())
                .active(active)
                .downloadUrl(downloadUrl(file.getFlMpnId()))
                .fstEnrDtm(file.getFstEnrDtm())
                .fstEnrUsid(file.getFstEnrUsid())
                .build();
    }

    private String downloadUrl(String flMpnId) {
        return "/api/files/" + flMpnId + "/download";
    }
}
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests '*UserGuideServiceTest' --no-daemon
```

기대: 10 tests PASS. `MockitoExtension`은 strict stubbing이므로 쓰이지 않는 `given(...)`이 있으면 실패한다 — 실패하면 그 스텁이 실제로 호출되는 경로인지 확인한다.

- [ ] **Step 6: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/userguide src/test/java/com/kdb/it/domain/userguide && git diff --cached --stat && git commit -m "feat: 사용자가이드 서비스와 DTO 추가 (단일 파일 교체 불변식)"
```

---

## Task 3: UserGuideController

**Files:**

- Create: `it_backend/src/main/java/com/kdb/it/domain/userguide/controller/UserGuideController.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/userguide/controller/UserGuideControllerTest.java`

**Interfaces:**

- Consumes: Task 2의 `UserGuideService`·`UserGuideDto`
- Produces: HTTP 계약 — `GET /api/user-guides/active`(인증 사용자, 없으면 204), `GET /api/user-guides/admin`(ADMIN), `POST /api/user-guides`(ADMIN, multipart 파트명 `file`), `PATCH /api/user-guides/{flMpnId}/active`(ADMIN, 본문 `{"active": true}`). Task 5의 프론트 컴포저블이 이 경로와 응답 형태에 의존한다.

- [ ] **Step 1: 실패하는 컨트롤러 테스트 작성**

`it_backend/src/test/java/com/kdb/it/domain/userguide/controller/UserGuideControllerTest.java`:

```java
package com.kdb.it.domain.userguide.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kdb.it.common.system.security.JwtUtil;
import com.kdb.it.common.system.service.CustomUserDetailsService;
import com.kdb.it.config.JacksonConfig;
import com.kdb.it.config.TestSecurityConfig;
import com.kdb.it.domain.userguide.dto.UserGuideDto;
import com.kdb.it.domain.userguide.service.UserGuideService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * UserGuideController @WebMvcTest
 *
 * <p>사용자가이드 API의 권한 경계와 응답 구조를 검증합니다.
 */
@WebMvcTest(UserGuideController.class)
@Import({
    TestSecurityConfig.class,
    JacksonConfig.class,
    UserGuideControllerTest.MethodSecurityTestConfig.class
})
class UserGuideControllerTest {

    /** TestSecurityConfig에는 @EnableMethodSecurity가 없어 @PreAuthorize가 꺼진다. 여기서 켠다. */
    @EnableMethodSecurity
    static class MethodSecurityTestConfig {}

    @Autowired private MockMvc mockMvc;

    @MockitoBean private UserGuideService userGuideService;
    @MockitoBean private JwtUtil jwtUtil;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;

    private static final String FL_MPN_ID = "FL-00000001";

    private UserGuideDto.Response response(boolean active) {
        return UserGuideDto.Response.builder()
                .flMpnId(FL_MPN_ID)
                .flNm("guide.pdf")
                .apgFlSz(2048L)
                .active(active)
                .downloadUrl("/api/files/" + FL_MPN_ID + "/download")
                .build();
    }

    @Test
    @WithMockUser
    @DisplayName("현재 가이드가 없으면 204를 반환한다")
    void getActive_noContent() throws Exception {
        given(userGuideService.getActiveGuide()).willReturn(Optional.empty());

        mockMvc.perform(get("/api/user-guides/active")).andExpect(status().isNoContent());
    }

    @Test
    @WithMockUser
    @DisplayName("현재 가이드가 있으면 200과 내려받기 URL을 반환한다")
    void getActive_ok() throws Exception {
        given(userGuideService.getActiveGuide()).willReturn(Optional.of(response(true)));

        mockMvc.perform(get("/api/user-guides/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flMpnId").value(FL_MPN_ID))
                .andExpect(
                        jsonPath("$.downloadUrl").value("/api/files/" + FL_MPN_ID + "/download"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("관리자는 전체 목록을 조회한다")
    void getAll_admin() throws Exception {
        given(userGuideService.getAllGuides()).willReturn(List.of(response(true)));

        mockMvc.perform(get("/api/user-guides/admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].flMpnId").value(FL_MPN_ID));
    }

    @Test
    @WithMockUser
    @DisplayName("일반 사용자는 전체 목록을 조회할 수 없다")
    void getAll_forbiddenForNonAdmin() throws Exception {
        mockMvc.perform(get("/api/user-guides/admin")).andExpect(status().isForbidden());
        verifyNoInteractions(userGuideService);
    }

    @Test
    @WithMockUser
    @DisplayName("일반 사용자는 업로드할 수 없다")
    void upload_forbiddenForNonAdmin() throws Exception {
        MockMultipartFile file =
                new MockMultipartFile("file", "guide.pdf", "application/pdf", "x".getBytes());

        mockMvc.perform(multipart("/api/user-guides").file(file))
                .andExpect(status().isForbidden());
        verifyNoInteractions(userGuideService);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("관리자 업로드는 201을 반환한다")
    void upload_created() throws Exception {
        given(userGuideService.upload(any())).willReturn(response(true));
        MockMultipartFile file =
                new MockMultipartFile("file", "guide.pdf", "application/pdf", "x".getBytes());

        mockMvc.perform(multipart("/api/user-guides").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("active 누락은 400이다")
    void setActive_missingActive_badRequest() throws Exception {
        mockMvc.perform(
                        patch("/api/user-guides/{flMpnId}/active", FL_MPN_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("관리자는 현재 가이드로 지정할 수 있다")
    void setActive_ok() throws Exception {
        given(userGuideService.setActive(anyString(), anyBoolean())).willReturn(response(true));

        mockMvc.perform(
                        patch("/api/user-guides/{flMpnId}/active", FL_MPN_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"active\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests '*UserGuideControllerTest' --no-daemon
```

기대: 컴파일 실패 — `UserGuideController` 심볼을 찾을 수 없음.

- [ ] **Step 3: 컨트롤러 구현**

`it_backend/src/main/java/com/kdb/it/domain/userguide/controller/UserGuideController.java`:

```java
package com.kdb.it.domain.userguide.controller;

import com.kdb.it.domain.userguide.dto.UserGuideDto;
import com.kdb.it.domain.userguide.service.UserGuideService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 사용자가이드 REST 컨트롤러
 *
 * <p>기본 URL: {@code /api/user-guides}
 *
 * <p>사용자가이드는 전용 테이블 없이 공통첨부파일기본(TPRMPP_CFILEM)을 재사용하며 {@code
 * APG_FL_KD_NM='사용자가이드'}·{@code APG_FL_LNK_CTZ_NM='HEADER'} 규약은 {@link UserGuideService}가
 * 강제한다.
 *
 * <p>파일 내려받기는 이 컨트롤러가 아니라 공통 {@code GET /api/files/{flMpnId}/download}를 쓴다. 종류
 * {@code 사용자가이드}의 읽기 권한은 {@code UserGuideFileReadAuthorizer}가 인증 사용자 전체로 판정한다.
 *
 * <p>보안: 현재 가이드 조회는 인증 사용자 전체, 나머지는 관리자 전용이다.
 */
@RestController
@RequestMapping("/api/user-guides")
@RequiredArgsConstructor
@Tag(name = "UserGuide", description = "사용자가이드 API")
public class UserGuideController {

    private final UserGuideService userGuideService;

    /**
     * 헤더 버튼에 노출할 현재 사용자가이드를 조회합니다.
     *
     * @return 현재 가이드. 등록된 가이드가 없으면 {@code 204 No Content}
     */
    @GetMapping("/active")
    @Operation(
            summary = "현재 사용자가이드 조회",
            description =
                    "DEL_YN='N'인 사용자가이드 1건을 조회합니다. 인증 사용자 전체가 조회할 수 있습니다. "
                            + "등록된 가이드가 없으면 204를 반환합니다 — 조회 실패(5xx)와 구분되는 정상 상태입니다.")
    public ResponseEntity<UserGuideDto.Response> getActiveGuide() {
        return userGuideService
                .getActiveGuide()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /**
     * 관리 화면용으로 현재 가이드와 이력을 모두 조회합니다.
     *
     * @return 파일매핑ID 내림차순(최신 우선) 전체 목록
     */
    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "사용자가이드 전체 목록 조회 (관리자)",
            description = "이력(DEL_YN='Y')을 포함해 전체를 최신순으로 조회합니다.")
    public ResponseEntity<List<UserGuideDto.Response>> getAllGuides() {
        return ResponseEntity.ok(userGuideService.getAllGuides());
    }

    /**
     * 사용자가이드를 업로드하고 현재 가이드로 지정합니다.
     *
     * @param file 업로드할 가이드 파일 (pdf·hwp·hwpx·docx·pptx)
     * @return 생성된 가이드 정보
     * @throws com.kdb.it.exception.CustomGeneralException 허용 확장자가 아닌 경우
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "사용자가이드 업로드 (관리자)",
            description =
                    "multipart/form-data로 가이드 파일 1개를 업로드합니다. "
                            + "주식별자컬럼명('사용자가이드')·주식별자내용('HEADER')·파일유형내용('첨부파일')은 서버가 고정합니다. "
                            + "기존 현재 가이드는 같은 트랜잭션에서 이력으로 내려갑니다. "
                            + "허용 확장자는 pdf, hwp, hwpx, docx, pptx입니다.")
    public ResponseEntity<UserGuideDto.Response> upload(
            @Parameter(description = "업로드할 사용자가이드 파일", required = true) @RequestPart("file")
                    MultipartFile file) {
        UserGuideDto.Response response = userGuideService.upload(file);
        return ResponseEntity.created(URI.create("/api/user-guides/" + response.getFlMpnId()))
                .body(response);
    }

    /**
     * 사용자가이드를 현재 가이드로 지정하거나 내립니다.
     *
     * @param flMpnId 대상 파일매핑ID
     * @param request 활성 여부 요청. {@code active} 누락 시 Bean Validation이 400을 발생시킨다
     * @return 변경된 가이드 정보
     * @throws com.kdb.it.exception.CustomGeneralException 해당 가이드가 없는 경우
     * @throws org.springframework.security.access.AccessDeniedException 대상이 사용자가이드가 아닌 경우
     */
    @PatchMapping("/{flMpnId}/active")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "현재 사용자가이드 지정·해제 (관리자)",
            description =
                    "active=true면 다른 활성 건을 내린 뒤 이 건을 현재 가이드로 지정하고, false면 이 건을 내립니다. "
                            + "물리 파일은 어느 쪽에서도 삭제하지 않습니다.")
    public ResponseEntity<UserGuideDto.Response> setActive(
            @PathVariable("flMpnId") String flMpnId,
            @Valid @RequestBody UserGuideDto.ActiveRequest request) {
        return ResponseEntity.ok(userGuideService.setActive(flMpnId, request.getActive()));
    }
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests '*UserGuideControllerTest' --no-daemon
```

기대: 8 tests PASS.

- [ ] **Step 5: 백엔드 전체 테스트로 회귀 확인**

```bash
cd C:/it/it_backend && ./gradlew test --no-daemon
```

기대: BUILD SUCCESSFUL. 새 종류가 `FileKindRegistry`에 들어가면서 깨지는 테스트가 없어야 한다. `FileReadAuthorizationIT.quarantineRows_notExposedToNormalUser`의 종류 하드코딩 목록은 테스트 네임스페이스 밖의 운영 행만 대상으로 하므로 원칙적으로 수정이 필요 없다 — 만약 이 테스트가 실패하면 그 목록에 `'사용자가이드'`를 추가한다.

- [ ] **Step 6: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/userguide/controller src/test/java/com/kdb/it/domain/userguide/controller && git diff --cached --stat && git commit -m "feat: 사용자가이드 REST 컨트롤러 추가"
```

---

## Task 4: 관리자 메뉴 시드 마이그레이션

**Files:**

- Create: `it_database/migrations/V20260830_003__SeedUserGuideAdminMenu.sql`
- Create: `it_database/migrations/_verify/user-guide-menu-seed-verify.sql`

**Interfaces:**

- Consumes: 기존 메뉴 스키마 — `TPRMPP_CMENUD`(경로 카탈로그), `TPRMPP_CMENUM`(메뉴), `TPRMPP_CLANGM`(다국어), `TPRMPP_CMENUA`(권한 매핑), 시퀀스 `SQ_TPRMPP_CMENUM_1`, 부모 메뉴 `MADM0010`(콘텐츠 관리)
- Produces: 화면경로 `/admin/user-guides`의 활성 메뉴 행 1건과 `ITPAD001` 권한 매핑 1건. Task 7이 만드는 페이지가 이 경로로 열린다.

이 Task는 SQL이라 TDD 사이클 대신 **작성 → 적용 → 검증 쿼리로 확인** 순서를 따른다.

- [ ] **Step 1: 마이그레이션 작성**

`it_database/migrations/V20260830_003__SeedUserGuideAdminMenu.sql`:

```sql
-- ============================================================================
-- 사용자가이드 관리 관리자 메뉴 시드
-- ============================================================================
-- 헤더 [사용자가이드] 버튼으로 배포할 포털 매뉴얼 파일을 업로드·교체하는
-- 화면(/admin/user-guides)의 경로 카탈로그·메뉴 행·영문명·권한 매핑을 추가한다.
--
-- [부모 메뉴]
--   사용자가이드는 화면에 노출되는 콘텐츠이므로 '배너 관리'와 같은 성격이다.
--   그 부모인 MADM0010(콘텐츠 관리)을 부모로 둔다.
--
-- [경로 카탈로그]
--   AdminMenuService.requireUsableCatalogPath()가 PGE 메뉴 저장 시 TPRMPP_CMENUD
--   행을 요구한다. 카탈로그가 없으면 관리자가 /admin/menus에서 이 메뉴를 다시
--   저장할 수 없으므로 CMENUM보다 먼저 넣는다.
--
-- [채번]
--   MNU_ID는 CmenumRepositoryImpl.nextMnuId()와 같은 형식('MNU' + SQ_TPRMPP_CMENUM_1
--   시퀀스를 7자리로 LPAD)을 SQL에서 재현한다.
--
-- [아이콘]
--   IMK_NM은 CSS 클래스로 바인딩되므로 `^[a-z0-9 -]{1,100}$`를 만족해야 한다.
--   'pi pi-book'은 프론트 선택지 목록(utils/menuPresentation.ts MENU_ICON_OPTIONS)에
--   이미 있으므로 프론트 수정 없이 메뉴관리 화면에서 재선택할 수 있다.
--
-- [권한 매핑]
--   MenuQueryService.isAllowed()는 매핑 0건을 "전체 공개"로 취급한다. 매핑을
--   비워 두면 재부모화만으로도 전사에 공개될 수 있으므로 ITPAD001을 반드시 채운다.
--
-- [재실행 안전]
--   같은 화면경로의 활성(DEL_YN='N') 메뉴가 이미 있으면 건너뛴다.
--   부모(MADM0010)가 없는 스키마에서도 조용히 건너뛴다.
-- ============================================================================

MERGE INTO ITPOWN.TPRMPP_CMENUD target
USING (SELECT '/admin/user-guides' AS sre_pth FROM DUAL) source
ON (target.SRE_PTH = source.sre_pth)
WHEN NOT MATCHED THEN
    INSERT (SRE_PTH, SRE_MNU_NM, USE_YN, RMK)
    VALUES (source.sre_pth, '사용자가이드 관리', 'Y', '헤더에서 내려받는 포털 사용자가이드 파일 관리');

DECLARE
    c_parent_id   CONSTANT VARCHAR2(10) := 'MADM0010';
    c_sre_pth     CONSTANT VARCHAR2(40) := '/admin/user-guides';
    v_parent_path ITPOWN.TPRMPP_CMENUM.WHL_MNU_PTH%TYPE;
    v_parent_dep  ITPOWN.TPRMPP_CMENUM.MNU_DEP%TYPE;
    v_mnu_id      ITPOWN.TPRMPP_CMENUM.MNU_ID%TYPE;
    v_max_sort    NUMBER;
    v_exists      NUMBER;
BEGIN
    BEGIN
        SELECT WHL_MNU_PTH, MNU_DEP
          INTO v_parent_path, v_parent_dep
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE MNU_ID = c_parent_id
           AND DEL_YN = 'N';
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN; -- 콘텐츠 관리 그룹이 없는 스키마는 시드 대상이 아니다
    END;

    SELECT COUNT(*)
      INTO v_exists
      FROM ITPOWN.TPRMPP_CMENUM
     WHERE SRE_PTH = c_sre_pth
       AND DEL_YN = 'N';

    IF v_exists = 0 THEN
        SELECT 'MNU' || LPAD(ITPOWN.SQ_TPRMPP_CMENUM_1.NEXTVAL, 7, '0') INTO v_mnu_id FROM DUAL;

        SELECT NVL(MAX(MNU_SOT_SQN_SNO), 0)
          INTO v_max_sort
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE HRK_MNU_ID = c_parent_id
           AND DEL_YN = 'N';

        INSERT INTO ITPOWN.TPRMPP_CMENUM (
            MNU_ID, HRK_MNU_ID, MNU_NM, MNU_TP_C, SRE_PTH, MNU_SOT_SQN_SNO,
            HID_YN, MNU_DEP, WHL_MNU_PTH, IMK_NM,
            DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_USID, FST_ENR_DTM, LST_CHG_USID, LST_CHG_DTM
        ) VALUES (
            v_mnu_id, c_parent_id, '사용자가이드 관리', 'PGE', c_sre_pth, v_max_sort + 10,
            'N', v_parent_dep + 1, v_parent_path || '/' || v_mnu_id, 'pi pi-book',
            'N',
            LOWER(REGEXP_REPLACE(RAWTOHEX(SYS_GUID()), '(.{8})(.{4})(.{4})(.{4})(.{12})', '\1-\2-\3-\4-\5')),
            1, 'MIGRATION', SYSDATE, 'MIGRATION', SYSDATE
        );
    END IF;
END;
/

MERGE INTO ITPOWN.TPRMPP_CLANGM target
USING (
    SELECT m.MNU_ID AS tc_id_cone
      FROM ITPOWN.TPRMPP_CMENUM m
     WHERE m.SRE_PTH = '/admin/user-guides'
       AND m.DEL_YN = 'N'
) source
ON (
    target.TC_ID_CONE = source.tc_id_cone
    AND target.DTT_LAN_C = 'en'
    AND target.TC_COL_NM = 'MNU_NM'
)
WHEN NOT MATCHED THEN
    INSERT (TC_ID_CONE, DTT_LAN_C, TC_COL_NM, TC_DES, DTT_NM, DEL_YN)
    VALUES (source.tc_id_cone, 'en', 'MNU_NM', 'User Guide', '메뉴', 'N');

INSERT INTO ITPOWN.TPRMPP_CMENUA
    (MNU_ID, ATH_ID, FST_ENR_USID, FST_ENR_DTM, DEL_YN, GUID, GUID_PRG_SNO, LST_CHG_USID, LST_CHG_DTM)
SELECT m.MNU_ID, 'ITPAD001', 'MIGRATION', SYSDATE, 'N',
       RAWTOHEX(SYS_GUID()), 0, 'MIGRATION', SYSDATE
  FROM ITPOWN.TPRMPP_CMENUM m
 WHERE m.SRE_PTH = '/admin/user-guides'
   AND m.DEL_YN = 'N'
   AND NOT EXISTS (
         SELECT 1
           FROM ITPOWN.TPRMPP_CMENUA a
          WHERE a.MNU_ID = m.MNU_ID
            AND a.ATH_ID = 'ITPAD001'
       );

COMMIT;
```

- [ ] **Step 2: 검증 스크립트 작성**

`it_database/migrations/_verify/user-guide-menu-seed-verify.sql`:

```sql
-- V20260830_003__SeedUserGuideAdminMenu.sql 적용 결과 검증
-- 기대: 네 쿼리 모두 EXPECTED_COUNT = 1

SELECT '1. CMENUD 경로 카탈로그' AS CHECK_NAME, COUNT(*) AS EXPECTED_COUNT
  FROM ITPOWN.TPRMPP_CMENUD
 WHERE SRE_PTH = '/admin/user-guides'
   AND USE_YN = 'Y'
UNION ALL
SELECT '2. CMENUM 활성 메뉴(부모 MADM0010, PGE, 아이콘)', COUNT(*)
  FROM ITPOWN.TPRMPP_CMENUM
 WHERE SRE_PTH = '/admin/user-guides'
   AND DEL_YN = 'N'
   AND HRK_MNU_ID = 'MADM0010'
   AND MNU_TP_C = 'PGE'
   AND IMK_NM = 'pi pi-book'
UNION ALL
SELECT '3. CLANGM 영문 메뉴명', COUNT(*)
  FROM ITPOWN.TPRMPP_CLANGM l
  JOIN ITPOWN.TPRMPP_CMENUM m ON m.MNU_ID = l.TC_ID_CONE
 WHERE m.SRE_PTH = '/admin/user-guides'
   AND m.DEL_YN = 'N'
   AND l.DTT_LAN_C = 'en'
   AND l.TC_COL_NM = 'MNU_NM'
   AND l.TC_DES = 'User Guide'
UNION ALL
SELECT '4. CMENUA ITPAD001 권한 매핑', COUNT(*)
  FROM ITPOWN.TPRMPP_CMENUA a
  JOIN ITPOWN.TPRMPP_CMENUM m ON m.MNU_ID = a.MNU_ID
 WHERE m.SRE_PTH = '/admin/user-guides'
   AND m.DEL_YN = 'N'
   AND a.ATH_ID = 'ITPAD001'
   AND a.DEL_YN = 'N';
```

- [ ] **Step 3: 마이그레이션 적용**

백엔드를 기동하면 Flyway가 자동 적용한다. 기동 로그에 `Migrating schema ... to version 20260830.003`가 보여야 한다.

```bash
cd C:/it/it_backend && ./gradlew bootRun
```

Oracle 비밀번호는 명령행 인자·문서·로그에 남기지 않는다. 환경변수 또는 비공개 프로파일로 주입한다.

- [ ] **Step 4: 검증 쿼리 실행**

SQL 클라이언트에서 `ITPOWN` 계정으로 `it_database/migrations/_verify/user-guide-menu-seed-verify.sql`을 실행한다.

기대: 네 행 모두 `EXPECTED_COUNT = 1`.

- [ ] **Step 5: 재실행 안전 확인**

같은 마이그레이션 본문을 SQL 클라이언트에서 한 번 더 수동 실행한 뒤 Step 4를 다시 돌린다.

기대: 여전히 네 행 모두 `1` (중복 메뉴·중복 매핑이 생기지 않는다).

- [ ] **Step 6: 커밋**

```bash
cd C:/it/it_database && git add migrations/V20260830_003__SeedUserGuideAdminMenu.sql migrations/_verify/user-guide-menu-seed-verify.sql && git diff --cached --stat && git commit -m "feat: 사용자가이드 관리 메뉴 시드 마이그레이션 추가"
```

---

## Task 5: 프론트 API 컴포저블 (useUserGuide)

**Files:**

- Create: `it_frontend/app/composables/useUserGuide.ts`
- Test: `it_frontend/tests/unit/composables/useUserGuide.test.ts`

**Interfaces:**

- Consumes: Task 3의 HTTP 계약. 프로젝트 공통 `useApiFetch(url, options)`(반응형 GET, `{ data, pending, error, refresh }` 반환)와 `useNuxtApp().$apiFetch`(일회성 요청). `~/composables/useAttachmentDownload`의 `saveAttachmentBlob(blob, fileName)`.
- Produces:
  - `export interface UserGuideRecord { flMpnId: string; flNm: string; apgFlSz: number | null; active: boolean; downloadUrl: string; fstEnrDtm: string; fstEnrUsid: string }`
  - `useUserGuide()` → `{ fetchActiveGuide, fetchAllGuides, uploadGuide, setGuideActive, downloadGuide }`
    - `fetchActiveGuide()` → `{ data, pending, error, refresh }` (`data.value`는 `UserGuideRecord | null`)
    - `fetchAllGuides()` → `{ data, pending, error, refresh }` (`data.value`는 `UserGuideRecord[] | null`)
    - `uploadGuide(file: File)` → `Promise<UserGuideRecord>`
    - `setGuideActive(flMpnId: string, active: boolean)` → `Promise<UserGuideRecord>`
    - `downloadGuide(guide: UserGuideRecord)` → `Promise<void>` (실패 시 예외를 호출자에게 전파)
  - Task 6·7이 이 이름들을 그대로 쓴다.

- [ ] **Step 1: 백엔드 OpenAPI 타입 재생성**

백엔드가 기동된 상태에서 실행한다.

```bash
cd C:/it/it_frontend && npm run codegen && npm run codegen:check
```

기대: `codegen:check`가 차이 없음으로 통과. 생성 타입은 수기로 편집하지 않는다.

- [ ] **Step 2: 실패하는 컴포저블 테스트 작성**

`it_frontend/tests/unit/composables/useUserGuide.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useUserGuide, type UserGuideRecord } from '~/composables/useUserGuide';

const apiFetch = vi.fn();
const apiFetchReactive = vi.fn();
const saveAttachmentBlob = vi.fn();

vi.mock('~/composables/useAttachmentDownload', () => ({
    saveAttachmentBlob: (...args: unknown[]) => saveAttachmentBlob(...args),
}));

vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:28080' } }));
vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: apiFetch }));
vi.stubGlobal('useApiFetch', (url: string, options?: unknown) => {
    apiFetchReactive(url, options);
    return { data: ref(null), pending: ref(false), error: ref(null), refresh: vi.fn() };
});

const guide: UserGuideRecord = {
    flMpnId: 'FL-00000001',
    flNm: 'guide.pdf',
    apgFlSz: 2048,
    active: true,
    downloadUrl: '/api/files/FL-00000001/download',
    fstEnrDtm: '2026-08-30T09:00:00',
    fstEnrUsid: 'E001',
};

describe('useUserGuide', () => {
    beforeEach(() => {
        apiFetch.mockReset();
        apiFetchReactive.mockReset();
        saveAttachmentBlob.mockReset();
    });

    it('현재 가이드는 /api/user-guides/active를 조회한다', () => {
        useUserGuide().fetchActiveGuide();

        expect(apiFetchReactive).toHaveBeenCalledWith(
            'http://localhost:28080/api/user-guides/active',
            expect.objectContaining({ suppressErrorToast: true }),
        );
    });

    it('관리 목록은 /api/user-guides/admin을 조회한다', () => {
        useUserGuide().fetchAllGuides();

        expect(apiFetchReactive).toHaveBeenCalledWith(
            'http://localhost:28080/api/user-guides/admin',
            undefined,
        );
    });

    it('업로드는 file 파트만 담은 multipart POST를 보낸다', async () => {
        apiFetch.mockResolvedValue(guide);
        const file = new File(['x'], 'guide.pdf', { type: 'application/pdf' });

        await useUserGuide().uploadGuide(file);

        const [url, options] = apiFetch.mock.calls[0];
        expect(url).toBe('http://localhost:28080/api/user-guides');
        expect(options.method).toBe('POST');
        expect(options.body).toBeInstanceOf(FormData);
        expect((options.body as FormData).get('file')).toBe(file);
    });

    it('활성 전환은 PATCH로 active 값을 보낸다', async () => {
        apiFetch.mockResolvedValue(guide);

        await useUserGuide().setGuideActive('FL-00000001', false);

        expect(apiFetch).toHaveBeenCalledWith(
            'http://localhost:28080/api/user-guides/FL-00000001/active',
            { method: 'PATCH', body: { active: false } },
        );
    });

    it('내려받기는 인증 쿠키를 쓰는 Blob 요청 후 원본 파일명으로 저장한다', async () => {
        const blob = new Blob(['x']);
        apiFetch.mockResolvedValue(blob);

        await useUserGuide().downloadGuide(guide);

        expect(apiFetch).toHaveBeenCalledWith(
            'http://localhost:28080/api/files/FL-00000001/download',
            { responseType: 'blob' },
        );
        expect(saveAttachmentBlob).toHaveBeenCalledWith(blob, 'guide.pdf');
    });
});
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useUserGuide.test.ts
```

기대: `~/composables/useUserGuide` 모듈을 찾을 수 없어 실패.

- [ ] **Step 4: 컴포저블 구현**

`it_frontend/app/composables/useUserGuide.ts`:

```ts
/**
 * ============================================================================
 * [composables/useUserGuide.ts] 사용자가이드 API Composable
 * ============================================================================
 * /api/user-guides 엔드포인트를 감쌉니다. 사용자가이드는 전용 테이블 없이 공통첨부파일기본
 * (TPRMPP_CFILEM)을 재사용하며 APG_FL_KD_NM='사용자가이드' / APG_FL_LNK_CTZ_NM='HEADER'
 * 규약은 서버가 고정합니다.
 *
 * [API 엔드포인트]
 *  GET   /api/user-guides/active            - 현재 가이드 1건 (인증 사용자 전체, 없으면 204)
 *  GET   /api/user-guides/admin             - 이력 포함 전체 목록 (관리자)
 *  POST  /api/user-guides                   - 가이드 업로드 (관리자, multipart/form-data)
 *  PATCH /api/user-guides/{flMpnId}/active  - 현재 가이드 지정·해제 (관리자)
 *
 * [내려받기]
 *  전용 경로 없이 공통 GET /api/files/{flMpnId}/download를 씁니다. 이 URL은 인증이 필요하므로
 *  <a href>로 직접 열지 않고 Blob을 받아 저장합니다.
 *
 * [단일 파일 교체]
 *  active=true인 행은 항상 0건 또는 1건입니다. 업로드와 되돌리기 모두 서버가 기존 활성 건을
 *  먼저 내립니다.
 * ============================================================================
 */
import { saveAttachmentBlob } from '~/composables/useAttachmentDownload';

/** 사용자가이드 응답 타입 — 백엔드 UserGuideDto.Response 매핑 */
export interface UserGuideRecord {
    flMpnId: string; // 파일매핑ID (PK)
    flNm: string; // 파일명
    apgFlSz: number | null; // 첨부파일크기(바이트), 레거시 파일은 null
    active: boolean; // 현재 가이드 여부 (DEL_YN='N'이면 true)
    downloadUrl: string; // 내려받기 상대 경로 (예: /api/files/FL-00000001/download)
    fstEnrDtm: string; // 최초 등록 일시
    fstEnrUsid: string; // 최초 등록 사용자 사번
}

/**
 * 사용자가이드 Composable
 *
 * @returns 가이드 조회·업로드·활성 전환·내려받기 함수
 */
export const useUserGuide = () => {
    const config = useRuntimeConfig();
    const API_BASE = `${config.public.apiBase}/api/user-guides`;

    const { $apiFetch } = useNuxtApp();

    /**
     * 헤더 버튼용 현재 가이드 조회.
     *
     * 서버가 가이드 없음을 204로 알리므로 `data.value`는 그때 null이 된다. 조회 실패는 `error`로
     * 구분되며 호출자가 두 상태를 합치지 않는다.
     *
     * 헤더는 모든 화면에 있어 초기 조회 실패 토스트가 화면마다 중복되므로 여기서는 억제하고,
     * 실패 사실은 버튼을 남겨 두는 것으로 드러낸다(클릭 시 재조회·토스트는 UserGuideButton 담당).
     */
    const fetchActiveGuide = () =>
        useApiFetch<UserGuideRecord | null>(`${API_BASE}/active`, { suppressErrorToast: true });

    /** 관리 화면용 전체(현재+이력) 목록 조회. 관리자만 200을 받습니다. */
    const fetchAllGuides = () => useApiFetch<UserGuideRecord[]>(`${API_BASE}/admin`);

    /**
     * 사용자가이드 업로드 (multipart/form-data).
     *
     * @param file 업로드할 가이드 파일
     * @returns 새 현재 가이드 정보
     * @throws 허용 확장자(pdf·hwp·hwpx·docx·pptx)가 아니거나 권한이 없으면 예외를 전파합니다.
     */
    const uploadGuide = async (file: File): Promise<UserGuideRecord> => {
        const formData = new FormData();
        formData.append('file', file);

        return await $apiFetch<UserGuideRecord>(API_BASE, {
            method: 'POST',
            body: formData,
        });
    };

    /**
     * 현재 가이드 지정·해제.
     *
     * @param flMpnId 대상 파일매핑ID
     * @param active true면 현재 가이드로 지정(다른 활성 건은 서버가 내림), false면 내림
     * @returns 변경된 가이드 정보
     * @throws 가이드가 없거나 관리자가 아니면 예외를 전파합니다.
     */
    const setGuideActive = async (flMpnId: string, active: boolean): Promise<UserGuideRecord> =>
        await $apiFetch<UserGuideRecord>(`${API_BASE}/${flMpnId}/active`, {
            method: 'PATCH',
            body: { active },
        });

    /**
     * 가이드 파일을 내려받습니다.
     *
     * @param guide 내려받을 가이드
     * @throws 요청이 실패하면 예외를 전파합니다. 사용자 알림은 호출자가 담당합니다.
     */
    const downloadGuide = async (guide: UserGuideRecord): Promise<void> => {
        const blob = await $apiFetch<Blob>(`${config.public.apiBase}${guide.downloadUrl}`, {
            responseType: 'blob',
        });
        const objectUrl = saveAttachmentBlob(blob, guide.flNm);
        URL.revokeObjectURL(objectUrl);
    };

    return {
        fetchActiveGuide,
        fetchAllGuides,
        uploadGuide,
        setGuideActive,
        downloadGuide,
    };
};
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useUserGuide.test.ts
```

기대: 5 tests PASS.

- [ ] **Step 6: 커밋**

```bash
cd C:/it/it_frontend && git add app/composables/useUserGuide.ts tests/unit/composables/useUserGuide.test.ts && git diff --cached --stat && git commit -m "feat: 사용자가이드 API 컴포저블 추가"
```

생성 타입 파일이 `npm run codegen`으로 바뀌었다면 같은 커밋에 경로를 명시해 함께 담는다.

---

## Task 6: 헤더 [사용자가이드] 버튼

**Files:**

- Create: `it_frontend/app/components/layout/UserGuideButton.vue`
- Modify: `it_frontend/app/components/layout/AppHeader.vue` (import 추가, 289행 부근 `<GlobalSearchBar />` 바로 앞에 삽입)
- Modify: `it_frontend/i18n/messages/layout.ts` (ko 블록 `header` 안, en 블록 `header` 안)
- Test: `it_frontend/tests/unit/components/UserGuideButton.test.ts`

**Interfaces:**

- Consumes: Task 5의 `useUserGuide()` — `fetchActiveGuide`, `downloadGuide`, 타입 `UserGuideRecord`
- Produces: `UserGuideButton.vue` (props 없음). `AppHeader.vue`가 `<UserGuideButton />`으로 쓴다.

**상태 계약(설계 §6.2)** — 조회 실패를 "가이드 없음"으로 위장하지 않는다.

| 상태 | 표시 |
| --- | --- |
| 조회 중 (`pending`) | 숨김 |
| 성공·가이드 있음 | 버튼 노출, 클릭 시 내려받기 |
| 성공·가이드 없음 (204 → `data`가 null) | 숨김 |
| 조회 실패 (`error`) | 버튼 노출, 클릭 시 재조회. 그래도 실패하면 오류 토스트 |

- [ ] **Step 1: i18n 키 추가**

`it_frontend/i18n/messages/layout.ts` — **ko 블록**의 `header` 객체 안, `approvalPendingBadge` 다음에 추가:

```ts
                /** 헤더 [통합검색] 좌측 사용자가이드 내려받기 버튼 */
                userGuide: {
                    label: '사용자가이드',
                    downloadFailed: '사용자가이드를 내려받지 못했습니다.',
                    loadFailed: '사용자가이드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
                },
```

같은 파일 **en 블록**의 `header` 객체 안, `approvalPendingBadge` 다음에 추가:

```ts
                userGuide: {
                    label: 'User Guide',
                    downloadFailed: 'Failed to download the user guide.',
                    loadFailed: 'Could not load user guide information. Please try again shortly.',
                },
```

- [ ] **Step 2: 실패하는 컴포넌트 테스트 작성**

`it_frontend/tests/unit/components/UserGuideButton.test.ts`:

```ts
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserGuideButton from '~/components/layout/UserGuideButton.vue';
import type { UserGuideRecord } from '~/composables/useUserGuide';

const guide: UserGuideRecord = {
    flMpnId: 'FL-00000001',
    flNm: 'guide.pdf',
    apgFlSz: 2048,
    active: true,
    downloadUrl: '/api/files/FL-00000001/download',
    fstEnrDtm: '2026-08-30T09:00:00',
    fstEnrUsid: 'E001',
};

const data = ref<UserGuideRecord | null>(null);
const pending = ref(false);
const error = ref<unknown>(null);
const refresh = vi.fn();
const downloadGuide = vi.fn();
const toastAdd = vi.fn();

vi.mock('~/composables/useUserGuide', () => ({
    useUserGuide: () => ({
        fetchActiveGuide: () => ({ data, pending, error, refresh }),
        downloadGuide,
    }),
}));

vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));

const BUTTON = '[data-testid="user-guide-trigger"]';

describe('UserGuideButton', () => {
    beforeEach(() => {
        data.value = null;
        pending.value = false;
        error.value = null;
        refresh.mockReset();
        downloadGuide.mockReset();
        toastAdd.mockReset();
    });

    it('조회 중에는 버튼을 그리지 않는다', () => {
        pending.value = true;

        expect(mount(UserGuideButton).find(BUTTON).exists()).toBe(false);
    });

    it('등록된 가이드가 없으면 버튼을 그리지 않는다', () => {
        expect(mount(UserGuideButton).find(BUTTON).exists()).toBe(false);
    });

    it('가이드가 있으면 버튼을 그리고 클릭 시 내려받는다', async () => {
        data.value = guide;
        const wrapper = mount(UserGuideButton);

        expect(wrapper.find(BUTTON).exists()).toBe(true);
        await wrapper.find(BUTTON).trigger('click');

        expect(downloadGuide).toHaveBeenCalledWith(guide);
        expect(toastAdd).not.toHaveBeenCalled();
    });

    it('조회에 실패해도 버튼을 남겨 재시도 경로를 준다', () => {
        error.value = new Error('boom');

        expect(mount(UserGuideButton).find(BUTTON).exists()).toBe(true);
    });

    it('조회 실패 후 클릭하면 재조회하고, 재조회도 비면 오류 토스트를 띄운다', async () => {
        error.value = new Error('boom');
        const wrapper = mount(UserGuideButton);

        await wrapper.find(BUTTON).trigger('click');
        await Promise.resolve();

        expect(refresh).toHaveBeenCalled();
        expect(downloadGuide).not.toHaveBeenCalled();
        expect(toastAdd).toHaveBeenCalledWith(
            expect.objectContaining({ severity: 'error' }),
        );
    });

    it('내려받기가 실패하면 오류 토스트를 띄운다', async () => {
        data.value = guide;
        downloadGuide.mockRejectedValue(new Error('boom'));
        const wrapper = mount(UserGuideButton);

        await wrapper.find(BUTTON).trigger('click');
        await Promise.resolve();
        await Promise.resolve();

        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
});
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/components/UserGuideButton.test.ts
```

기대: `~/components/layout/UserGuideButton.vue`를 찾을 수 없어 실패.

- [ ] **Step 4: 컴포넌트 구현**

`it_frontend/app/components/layout/UserGuideButton.vue`:

```vue
<!--
================================================================================
[components/layout/UserGuideButton.vue] 헤더 사용자가이드 내려받기 버튼
================================================================================
관리자가 /admin/user-guides에서 올린 현재 사용자가이드를 헤더에서 바로 내려받게 합니다.
[통합검색] 좌측에 놓입니다.

[표시 규칙]
  - 조회 중          : 그리지 않는다 (깜빡임 방지)
  - 가이드 없음(204) : 그리지 않는다
  - 가이드 있음      : 버튼 노출. 클릭 시 인증 쿠키를 포함해 Blob으로 내려받는다
  - 조회 실패        : 버튼을 남긴다. 실패를 '가이드 없음'으로 위장하지 않기 위해서다.
                       클릭하면 재조회하고, 그래도 없으면 오류 토스트로 알린다.

[데이터]
  GET /api/user-guides/active → DEL_YN='N' AND APG_FL_KD_NM='사용자가이드'
  내려받기는 공통 GET /api/files/{flMpnId}/download를 쓴다.
================================================================================
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useUserGuide, type UserGuideRecord } from '~/composables/useUserGuide';

const { t } = useI18n();
const toast = useToast();
const { fetchActiveGuide, downloadGuide } = useUserGuide();

const { data, pending, error, refresh } = fetchActiveGuide();

const guide = computed<UserGuideRecord | null>(() => data.value ?? null);

/** 조회 실패는 버튼을 남겨 드러낸다. 조회 중과 '가이드 없음'만 숨긴다. */
const visible = computed(() => !pending.value && (guide.value !== null || Boolean(error.value)));

/** 내려받는 중에는 버튼을 잠가 중복 요청을 막는다. */
const downloading = ref(false);

const notifyError = (summary: string) => {
    toast.add({ severity: 'error', summary, life: 3000 });
};

/**
 * 현재 가이드를 내려받습니다.
 *
 * 조회에 실패해 가이드를 모르는 상태면 먼저 재조회하고, 그래도 없으면 오류로 알립니다.
 */
const handleClick = async () => {
    if (downloading.value) return;
    downloading.value = true;
    try {
        let target = guide.value;
        if (!target) {
            await refresh();
            target = data.value ?? null;
        }
        if (!target) {
            notifyError(t('layout.header.userGuide.loadFailed'));
            return;
        }
        await downloadGuide(target);
    } catch {
        notifyError(t('layout.header.userGuide.downloadFailed'));
    } finally {
        downloading.value = false;
    }
};
</script>

<template>
    <button
        v-if="visible"
        type="button"
        data-testid="user-guide-trigger"
        :disabled="downloading"
        class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-zinc-800"
        :title="t('layout.header.userGuide.label')"
        :aria-label="t('layout.header.userGuide.label')"
        @click="handleClick"
    >
        <i :class="['pi text-base', downloading ? 'pi-spin pi-spinner' : 'pi-book']" />
        <span class="hidden lg:inline">{{ t('layout.header.userGuide.label') }}</span>
    </button>
</template>
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/components/UserGuideButton.test.ts
```

기대: 6 tests PASS.

- [ ] **Step 6: AppHeader에 버튼 삽입**

`it_frontend/app/components/layout/AppHeader.vue` — `<script setup>`의 import 블록에서 `GlobalSearchBar` import 다음 줄에 추가:

```ts
import UserGuideButton from './UserGuideButton.vue';
```

템플릿의 우측 영역(`<!-- 우측 영역: 검색·테마·알림·사용자 -->` 바로 아래 `div`) 안에서 `<GlobalSearchBar />` **앞**에 삽입:

```vue
                <!-- 사용자가이드 내려받기 — 등록된 가이드가 있을 때만 노출된다 -->
                <UserGuideButton />

                <!-- 통합검색 (V1 기본 상태 + V2 포커스 드롭다운) -->
                <GlobalSearchBar />
```

- [ ] **Step 7: AppHeader 테스트가 깨지지 않는지 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/components/AppHeader.test.ts tests/unit/components/UserGuideButton.test.ts
```

기대: 모두 PASS. `AppHeader.test.ts`는 `shallowMount`라 자식 컴포넌트를 스텁하므로 `useUserGuide` 모킹이 필요 없다. 만약 실패하면 그 테스트에 `vi.mock('~/composables/useUserGuide', ...)`를 추가한다.

- [ ] **Step 8: 커밋**

```bash
cd C:/it/it_frontend && git add app/components/layout/UserGuideButton.vue app/components/layout/AppHeader.vue i18n/messages/layout.ts tests/unit/components/UserGuideButton.test.ts && git diff --cached --stat && git commit -m "feat: 헤더 통합검색 좌측에 사용자가이드 내려받기 버튼 추가"
```

---

## Task 7: 사용자가이드 관리 화면

**Files:**

- Create: `it_frontend/app/pages/admin/user-guides.vue`
- Modify: `it_frontend/i18n/messages/admin.ts` (ko 블록 `admin` 안, en 블록 `admin` 안)
- Test: `it_frontend/tests/unit/pages/AdminUserGuides.test.ts`

**Interfaces:**

- Consumes: Task 5의 `useUserGuide()` — `fetchAllGuides`, `uploadGuide`, `setGuideActive`, `downloadGuide`. 공통 컴포넌트 `PageHeader`(props `title`·`subtitle`, 슬롯 `#actions`), `TableCard`, `StyledDataTable`(props `value`·`loading`·`data-key`, 슬롯 `#empty`), `EmployeeLink`(prop `eno`), 유틸 `formatDateTime`·`formatFileSize`(`~/utils/common`)
- Produces: 화면 경로 `/admin/user-guides` (Task 4의 메뉴가 가리키는 경로)

- [ ] **Step 1: i18n 키 추가**

`it_frontend/i18n/messages/admin.ts` — **ko 블록**의 `admin` 객체 안, `banners` 블록 다음에 추가:

```ts
            userGuides: {
                title: '사용자가이드 관리',
                description:
                    '헤더 [사용자가이드] 버튼으로 전 직원이 내려받는 포털 매뉴얼을 관리합니다. 새로 올리면 기존 가이드는 이력으로 내려갑니다.',
                upload: '가이드 업로드',
                empty: '등록된 사용자가이드가 없습니다.',
                current: '현재 가이드',
                history: '이력',
                download: '내려받기',
                setCurrent: '현재 가이드로 지정',
                unsetCurrent: '현재 가이드 내리기',
                columns: {
                    fileName: '파일명',
                    fileSize: '크기',
                    status: '상태',
                    registeredBy: '등록자',
                    registeredAt: '등록일시',
                    actions: '작업',
                },
                toast: {
                    uploadSuccess: '사용자가이드를 등록했습니다.',
                    uploadFailed: '사용자가이드 등록에 실패했습니다.',
                    activated: '현재 가이드로 지정했습니다.',
                    deactivated: '현재 가이드를 내렸습니다.',
                    toggleFailed: '가이드 상태 변경에 실패했습니다.',
                    downloadFailed: '가이드를 내려받지 못했습니다.',
                    invalidExtension:
                        '문서 파일(pdf, hwp, hwpx, docx, pptx)만 등록할 수 있습니다.',
                },
            },
```

같은 파일 **en 블록**의 `admin` 객체 안, `banners` 블록 다음에 추가:

```ts
            userGuides: {
                title: 'User Guide',
                description:
                    'Manage the portal manual that everyone downloads from the User Guide button in the header. Uploading a new file moves the previous one to history.',
                upload: 'Upload Guide',
                empty: 'No user guide registered.',
                current: 'Current',
                history: 'History',
                download: 'Download',
                setCurrent: 'Make current',
                unsetCurrent: 'Remove from header',
                columns: {
                    fileName: 'File Name',
                    fileSize: 'Size',
                    status: 'Status',
                    registeredBy: 'Registered By',
                    registeredAt: 'Registered At',
                    actions: 'Actions',
                },
                toast: {
                    uploadSuccess: 'User guide uploaded.',
                    uploadFailed: 'Failed to upload the user guide.',
                    activated: 'Set as the current guide.',
                    deactivated: 'Removed the current guide from the header.',
                    toggleFailed: 'Failed to change the guide status.',
                    downloadFailed: 'Failed to download the guide.',
                    invalidExtension:
                        'Only document files (pdf, hwp, hwpx, docx, pptx) can be uploaded.',
                },
            },
```

- [ ] **Step 2: 실패하는 페이지 테스트 작성**

`it_frontend/tests/unit/pages/AdminUserGuides.test.ts`:

```ts
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminUserGuides from '~/pages/admin/user-guides.vue';
import type { UserGuideRecord } from '~/composables/useUserGuide';

const record = (flMpnId: string, active: boolean): UserGuideRecord => ({
    flMpnId,
    flNm: `${flMpnId}.pdf`,
    apgFlSz: 2048,
    active,
    downloadUrl: `/api/files/${flMpnId}/download`,
    fstEnrDtm: '2026-08-30T09:00:00',
    fstEnrUsid: 'E001',
});

const guides = ref<UserGuideRecord[]>([]);
const refresh = vi.fn();
const uploadGuide = vi.fn();
const setGuideActive = vi.fn();
const downloadGuide = vi.fn();
const toastAdd = vi.fn();

vi.mock('~/composables/useUserGuide', () => ({
    useUserGuide: () => ({
        fetchAllGuides: () => ({ data: guides, pending: ref(false), error: ref(null), refresh }),
        uploadGuide,
        setGuideActive,
        downloadGuide,
    }),
}));

vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
vi.stubGlobal('definePageMeta', () => {});

/** DataTable은 행 슬롯만 확인하면 되므로 value를 그대로 펼치는 스텁으로 대체한다. */
const TableStub = {
    name: 'StyledDataTable',
    props: ['value'],
    template: '<div><slot /></div>',
};

const mountPage = () =>
    mount(AdminUserGuides, {
        global: {
            stubs: {
                PageHeader: { template: '<div><slot name="actions" /></div>' },
                TableCard: { template: '<div><slot /></div>' },
                StyledDataTable: TableStub,
                Column: { template: '<div><slot /></div>' },
                Button: { template: '<button><slot /></button>' },
                EmployeeLink: true,
            },
        },
    });

describe('admin/user-guides', () => {
    beforeEach(() => {
        guides.value = [record('FL-00000002', true), record('FL-00000001', false)];
        refresh.mockReset();
        uploadGuide.mockReset();
        setGuideActive.mockReset();
        downloadGuide.mockReset();
        toastAdd.mockReset();
    });

    it('허용 확장자 밖 파일은 업로드 요청을 보내지 않고 경고한다', async () => {
        const wrapper = mountPage();
        const file = new File(['x'], 'guide.exe', { type: 'application/octet-stream' });
        const input = wrapper.find('input[type="file"]');
        Object.defineProperty(input.element, 'files', { value: [file] });

        await input.trigger('change');

        expect(uploadGuide).not.toHaveBeenCalled();
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn' }));
    });

    it('허용 확장자 파일은 업로드하고 목록을 갱신한다', async () => {
        uploadGuide.mockResolvedValue(record('FL-00000003', true));
        const wrapper = mountPage();
        const file = new File(['x'], 'guide.pdf', { type: 'application/pdf' });
        const input = wrapper.find('input[type="file"]');
        Object.defineProperty(input.element, 'files', { value: [file] });

        await input.trigger('change');
        await Promise.resolve();
        await Promise.resolve();

        expect(uploadGuide).toHaveBeenCalledWith(file);
        expect(refresh).toHaveBeenCalled();
    });
});
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/pages/AdminUserGuides.test.ts
```

기대: `~/pages/admin/user-guides.vue`를 찾을 수 없어 실패.

- [ ] **Step 4: 페이지 구현**

`it_frontend/app/pages/admin/user-guides.vue`:

```vue
<!--
================================================================================
[pages/admin/user-guides.vue] 사용자가이드 관리 페이지
================================================================================
시스템관리자가 헤더 [사용자가이드] 버튼으로 배포할 포털 매뉴얼을 관리하는 화면입니다.

[주요 기능]
  - 가이드 업로드 (pdf, hwp, hwpx, docx, pptx) — 올리면 기존 가이드는 이력으로 내려간다
  - 이력 행을 다시 현재 가이드로 지정 / 현재 가이드 내리기
  - 현재·이력 모두 내려받기

[데이터]
  사용자가이드는 전용 테이블 없이 TPRMPP_CFILEM을 재사용합니다.
  APG_FL_KD_NM='사용자가이드' / APG_FL_LNK_CTZ_NM='HEADER' 규약은 서버(UserGuideService)가
  고정하며, 현재 가이드(DEL_YN='N')는 항상 0건 또는 1건입니다.
================================================================================
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import PageHeader from '~/components/common/PageHeader.vue';
import TableCard from '~/components/common/TableCard.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import EmployeeLink from '~/components/common/EmployeeLink.vue';
import { useUserGuide, type UserGuideRecord } from '~/composables/useUserGuide';
import { formatDateTime, formatFileSize } from '~/utils/common';

definePageMeta({ middleware: 'admin' });

/** 사용자가이드로 허용하는 확장자 — 서버(UserGuideService.ALLOWED_EXTENSIONS)와 같은 목록이다. */
const ALLOWED_EXTENSIONS = ['pdf', 'hwp', 'hwpx', 'docx', 'pptx'];

const { t } = useI18n();
const toast = useToast();
const { fetchAllGuides, uploadGuide, setGuideActive, downloadGuide } = useUserGuide();

const { data: guides, pending, refresh } = fetchAllGuides();

const rows = computed<UserGuideRecord[]>(() => guides.value ?? []);

/** 숨김 file input — [가이드 업로드] 버튼이 대신 연다 */
const fileInputRef = ref<HTMLInputElement | null>(null);

/** 확장자가 허용 목록에 있는지 확인한다. 서버 거절 전에 사용자에게 먼저 알린다. */
const hasAllowedExtension = (name: string) => {
    const dot = name.lastIndexOf('.');
    return dot >= 0 && ALLOWED_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
};

/**
 * 선택한 파일을 업로드하고 목록을 갱신한다.
 *
 * 확장자가 허용 목록 밖이면 요청을 보내지 않고 토스트로 알린다.
 */
const handleUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // 같은 파일을 다시 선택해도 change가 발생하도록 초기화
    if (!file) return;

    if (!hasAllowedExtension(file.name)) {
        toast.add({
            severity: 'warn',
            summary: t('admin.userGuides.toast.invalidExtension'),
            life: 3000,
        });
        return;
    }

    try {
        await uploadGuide(file);
        toast.add({
            severity: 'success',
            summary: t('admin.userGuides.toast.uploadSuccess'),
            life: 3000,
        });
    } catch {
        toast.add({
            severity: 'error',
            summary: t('admin.userGuides.toast.uploadFailed'),
            life: 3000,
        });
    } finally {
        await refresh();
    }
};

/**
 * 현재 가이드를 지정하거나 내린다.
 *
 * 서버가 다른 활성 건을 함께 내리므로 성공·실패 모두 목록을 다시 조회해 화면을 서버 상태에 맞춘다.
 */
const handleToggleActive = async (guide: UserGuideRecord, active: boolean) => {
    try {
        await setGuideActive(guide.flMpnId, active);
        toast.add({
            severity: 'success',
            summary: active
                ? t('admin.userGuides.toast.activated')
                : t('admin.userGuides.toast.deactivated'),
            life: 3000,
        });
    } catch {
        toast.add({
            severity: 'error',
            summary: t('admin.userGuides.toast.toggleFailed'),
            life: 3000,
        });
    } finally {
        await refresh();
    }
};

/** 내려받는 중인 파일매핑ID (없으면 null) */
const downloadingId = ref<string | null>(null);

const handleDownload = async (guide: UserGuideRecord) => {
    downloadingId.value = guide.flMpnId;
    try {
        await downloadGuide(guide);
    } catch {
        toast.add({
            severity: 'error',
            summary: t('admin.userGuides.toast.downloadFailed'),
            life: 3000,
        });
    } finally {
        downloadingId.value = null;
    }
};
</script>

<template>
    <div class="space-y-6">
        <PageHeader
            :title="t('admin.userGuides.title')"
            :subtitle="t('admin.userGuides.description')"
        >
            <template #actions>
                <Button
                    icon="pi pi-upload"
                    :label="t('admin.userGuides.upload')"
                    @click="fileInputRef?.click()"
                />
            </template>
        </PageHeader>

        <input
            ref="fileInputRef"
            type="file"
            accept=".pdf,.hwp,.hwpx,.docx,.pptx"
            class="hidden"
            @change="handleUpload"
        />

        <TableCard>
            <StyledDataTable :value="rows" :loading="pending" data-key="flMpnId">
                <template #empty>{{ t('admin.userGuides.empty') }}</template>

                <Column field="flNm" :header="t('admin.userGuides.columns.fileName')" />

                <Column :header="t('admin.userGuides.columns.fileSize')">
                    <template #body="{ data }">{{ formatFileSize(data.apgFlSz) }}</template>
                </Column>

                <Column :header="t('admin.userGuides.columns.status')">
                    <template #body="{ data }">
                        <Tag
                            :severity="data.active ? 'success' : 'secondary'"
                            :value="
                                data.active
                                    ? t('admin.userGuides.current')
                                    : t('admin.userGuides.history')
                            "
                        />
                    </template>
                </Column>

                <Column :header="t('admin.userGuides.columns.registeredBy')">
                    <template #body="{ data }">
                        <EmployeeLink :eno="data.fstEnrUsid" />
                    </template>
                </Column>

                <Column :header="t('admin.userGuides.columns.registeredAt')">
                    <template #body="{ data }">{{ formatDateTime(data.fstEnrDtm) }}</template>
                </Column>

                <Column :header="t('admin.userGuides.columns.actions')">
                    <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <Button
                                text
                                size="small"
                                icon="pi pi-download"
                                :label="t('admin.userGuides.download')"
                                :loading="downloadingId === data.flMpnId"
                                @click="handleDownload(data)"
                            />
                            <Button
                                v-if="data.active"
                                text
                                size="small"
                                severity="secondary"
                                :label="t('admin.userGuides.unsetCurrent')"
                                @click="handleToggleActive(data, false)"
                            />
                            <Button
                                v-else
                                text
                                size="small"
                                :label="t('admin.userGuides.setCurrent')"
                                @click="handleToggleActive(data, true)"
                            />
                        </div>
                    </template>
                </Column>
            </StyledDataTable>
        </TableCard>
    </div>
</template>
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/pages/AdminUserGuides.test.ts
```

기대: 2 tests PASS.

- [ ] **Step 6: 커밋**

```bash
cd C:/it/it_frontend && git add app/pages/admin/user-guides.vue i18n/messages/admin.ts tests/unit/pages/AdminUserGuides.test.ts && git diff --cached --stat && git commit -m "feat: 사용자가이드 관리 화면 추가"
```

---

## Task 8: 전체 검증과 문서 반영

**Files:**

- Modify: `C:/it/TASK_DONE.md` (완료 기록 추가)
- Modify: `C:/it/versions.lock` (`scripts/update-versions-lock.ps1`이 갱신)

**Interfaces:**

- Consumes: Task 1~7의 모든 산출물
- Produces: 세 저장소의 호환 커밋 조합 기록

- [ ] **Step 1: 백엔드 Health Stack**

```bash
cd C:/it/it_backend && ./gradlew test --no-daemon
```

기대: BUILD SUCCESSFUL.

- [ ] **Step 2: 프론트엔드 Health Stack**

```bash
cd C:/it/it_frontend && npm run format:check && npm run check && npm test
```

기대: 세 명령 모두 성공. `npm run check`는 타입 검사, `npm test`는 i18n 키 ko·en 대응 검사까지 포함하므로 Task 6·7에서 추가한 키가 양쪽에 다 있어야 통과한다.

- [ ] **Step 3: OpenAPI 계약 재확인**

백엔드가 기동된 상태에서 실행한다.

```bash
cd C:/it/it_frontend && npm run codegen:check
```

기대: 차이 없음. 차이가 나면 `npm run codegen`으로 재생성하고 생성 파일을 커밋에 포함한다.

- [ ] **Step 4: 실제 브라우저에서 왕복 확인**

백엔드·프론트를 기동하고 관리자 계정으로 다음을 순서대로 확인한다. 단위 테스트는 jsdom이라 실제 내려받기 동작을 잡지 못하므로 이 단계를 생략하지 않는다.

1. 사이드바 [콘텐츠 관리] 아래 [사용자가이드 관리] 메뉴가 보인다.
2. 가이드가 하나도 없을 때 헤더에 [사용자가이드] 버튼이 **보이지 않는다.**
3. `/admin/user-guides`에서 pdf를 업로드하면 목록에 `현재 가이드` 상태로 나타난다.
4. 헤더 [통합검색] **좌측**에 [사용자가이드] 버튼이 나타나고, 클릭하면 원본 파일명으로 파일이 저장된다.
5. 두 번째 파일을 업로드하면 첫 파일이 `이력`으로 바뀌고 현재 가이드는 1건만 남는다.
6. 이력 행의 [현재 가이드로 지정]을 누르면 두 상태가 서로 뒤바뀐다.
7. [현재 가이드 내리기]를 누르면 헤더 버튼이 사라진다.
8. 일반 사용자 계정으로 로그인해 헤더 버튼으로 가이드를 내려받을 수 있다(전사 공개).
9. 같은 일반 사용자 계정으로 `/admin/user-guides`에 직접 접근하면 막힌다.

- [ ] **Step 5: 호환 버전 기록**

```bash
cd C:/it && ./scripts/update-versions-lock.ps1
```

- [ ] **Step 6: TASK_DONE.md에 완료 기록 추가**

`C:/it/TASK_DONE.md`의 형식을 그대로 따라, 사용자가이드 관리 기능 항목을 추가한다. 최소한 다음을 담는다.

- 완료일 2026-08-30
- 세 저장소 변경 요약(신규 종류 `사용자가이드`, `/api/user-guides`, `/admin/user-guides`, 헤더 버튼, 메뉴 시드 `V20260830_003`)
- 설계·계획 문서 경로

- [ ] **Step 7: 루트 저장소 커밋**

```bash
cd C:/it && git add versions.lock TASK_DONE.md docs/superpowers/specs/2026-08-30-user-guide-design.md docs/superpowers/plans/2026-08-30-user-guide.md && git diff --cached --stat && git commit -m "docs: 사용자가이드 관리 기능 설계·계획 기록과 호환 버전 갱신"
```

---

## 미해결 확인 사항

- Step 4의 브라우저 확인에서 관리자·일반 사용자 두 계정이 필요하다. 계정이 준비돼 있지 않으면 그 시점에 요청한다.
- `FileReadAuthorizationIT`의 종류 하드코딩 목록은 원칙적으로 손대지 않는다(Task 3 Step 5 참고). 실제로 실패하면 그때 목록에 `'사용자가이드'`를 추가하고, 왜 필요한지 커밋 메시지에 남긴다.
