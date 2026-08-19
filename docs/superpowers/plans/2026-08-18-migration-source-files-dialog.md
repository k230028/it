# 편성요청서 반입 원본 파일 조회 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 편성요청서 반입으로 만들어진 사업·전산업무비의 결재현황에서, 빈 신청서 PDF 대신 부점이 업로드한 원본 엑셀 목록을 다이얼로그로 보여준다.

**Architecture:** 반입 시 업로드 엑셀을 기존 공통첨부파일(`TPRMPP_CFILEM`)에 `PK_COL_NM='편성요청서반입'`, `PK_CONE=반입 받이 신청서번호`로 붙인다. 부점 폴더의 파일을 그 폴더에서 생성된 모든 신청서번호에 연결하되 디스크에는 파일당 1벌만 쓰고 나머지는 물리 경로를 공유하는 메타행만 만든다. 프론트는 `ApplicationViewerDialog` 안에서 신청서 응답의 `migrated` 플래그로 갈라 PDF 대신 파일 목록을 그린다.

**Tech Stack:** Spring Boot / JPA / JUnit 5 + Mockito + AssertJ (백엔드), Nuxt 4 CSR / Vue 3 Composition API / PrimeVue / Vitest (프론트)

설계 문서: [docs/superpowers/specs/2026-08-18-migration-source-files-dialog-design.md](../specs/2026-08-18-migration-source-files-dialog-design.md)

## Global Constraints

- 신규 테이블·Flyway 스크립트를 만들지 않는다. `meta/table.txt`도 손대지 않는다.
- 모든 신규 주석은 한글로 쓴다. public API·service 메서드에는 입력값과 실패 조건을 함께 적는다.
- 프론트의 사용자 노출 문구는 전부 i18n 키로 넣는다. 고정 리터럴은 `npm run check:copy` ratchet이 막는다.
- i18n 문구는 `it_frontend/i18n/messages/*.ts`의 **한국어 블록과 영어 블록 양쪽**에 넣는다. 한쪽만 넣으면 타입 검사가 깨진다.
- `git add`는 경로를 명시한다. `git add -A`, `git add .`, `git commit -a`를 쓰지 않는다. 이 워킹트리는 다른 작업과 공유되므로 커밋 직전 `git diff --cached --stat`으로 스테이징 목록이 의도한 경로와 정확히 일치하는지 확인한다.
- 파일 종류 문자열은 `편성요청서반입` 하나로 고정한다. 이 값은 `RequestFormSourceFileArchiver.PK_COL_NM` 상수가 단일 출처다.
- 반입 받이 표식 문구는 `MigrationApprovalMarker.NOTE` 하나가 단일 출처다. 문자열을 다시 쓰지 않는다.
- **BLOCKED·FAILED 파일은 보관하지 않는다.** APPLIED 파일만 저장한다.
- 백엔드 DTO를 바꾸면 `it_backend/src/test/java/com/kdb/it/domain/migration/**/*OpenApiContractTest.java`가 깨질 수 있다. Task 완료 전 `./gradlew test`로 확인한다.

---

### Task 1: 반입 표식 상수 공용화와 `migrated` 플래그

반입 건인지 판별할 수 있게 신청서 조회 응답에 플래그를 하나 더한다. 판별 근거인 고정 문구는 지금
`MigrationApprovalStamper`의 private 상수라 `common.approval`에서 볼 수 없으므로, 공용 위치로 옮긴다.
`common`이 `domain.migration`을 import하는 역방향 의존을 만들지 않기 위해서다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/domain/MigrationApprovalMarker.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationApprovalStamper.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/dto/ApplicationResponseMigratedTest.java`

**Interfaces:**
- Consumes: `ApplicationRepository.ApplicationReadView.getRgprDcdReqCone()` (기존)
- Produces:
  - `MigrationApprovalMarker.NOTE` — `String` 상수
  - `MigrationApprovalMarker.isMigrated(String rgprDcdReqCone)` → `boolean`
  - `ApplicationDto.Response.isMigrated()` → `boolean` (Lombok `@Getter`, 빌더 메서드는 `.migrated(boolean)`)
  - JSON 응답 필드 `migrated` (Task 6이 소비)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`it_backend/src/test/java/com/kdb/it/common/approval/dto/ApplicationResponseMigratedTest.java`:

```java
package com.kdb.it.common.approval.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kdb.it.common.approval.domain.MigrationApprovalMarker;
import com.kdb.it.common.approval.repository.ApplicationRepository;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ApplicationResponseMigratedTest {

    private ApplicationRepository.ApplicationReadView view(String rgprDcdReqCone) {
        ApplicationRepository.ApplicationReadView view =
                mock(ApplicationRepository.ApplicationReadView.class);
        when(view.getApfMngNo()).thenReturn("APF-2026-00000001");
        when(view.getRgprDcdReqCone()).thenReturn(rgprDcdReqCone);
        return view;
    }

    @Test
    @DisplayName("이관 표식 문구가 들어 있으면 migrated=true")
    void migrated_whenMigrationNote() {
        ApplicationDto.Response response =
                ApplicationDto.Response.fromReadViews(
                        view(MigrationApprovalMarker.NOTE), List.of(), null, null);

        assertThat(response.isMigrated()).isTrue();
    }

    @Test
    @DisplayName("일반 신청서는 migrated=false")
    void notMigrated_whenOrdinaryOpinion() {
        ApplicationDto.Response response =
                ApplicationDto.Response.fromReadViews(view("검토 부탁드립니다."), List.of(), null, null);

        assertThat(response.isMigrated()).isFalse();
    }

    @Test
    @DisplayName("등록자결재요청내용이 null이어도 예외 없이 false")
    void notMigrated_whenNullOpinion() {
        ApplicationDto.Response response =
                ApplicationDto.Response.fromReadViews(view(null), List.of(), null, null);

        assertThat(response.isMigrated()).isFalse();
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*ApplicationResponseMigratedTest*"`
Expected: 컴파일 실패 — `MigrationApprovalMarker` 심볼을 찾을 수 없음

- [ ] **Step 3: 표식 상수 클래스를 만든다**

`it_backend/src/main/java/com/kdb/it/common/approval/domain/MigrationApprovalMarker.java`:

```java
package com.kdb.it.common.approval.domain;

/**
 * 수기 엑셀 이관으로 만들어진 결재완료 기록을 식별하는 표식입니다.
 *
 * <p>이관 받이는 결재선({@code TPRMPP_CDECIM})을 만들지 않고 신청서 본문({@code APF_DTL_CONE})도 비어 있어, 일반
 * 신청서와 같은 화면 흐름을 태우면 빈 문서가 됩니다. 그 구분을 등록자결재요청내용({@code RGPR_DCD_REQ_CONE})에 남기는 고정
 * 문구로 합니다.
 *
 * <p>이 상수는 이관을 만드는 쪽({@code MigrationApprovalStamper})과 읽는 쪽({@code ApplicationDto})이 함께
 * 쓰므로 공통 패키지에 둡니다. {@code common}이 {@code domain.migration}을 참조하는 역방향 의존을 막기 위한 배치입니다.
 * 문구를 바꾸면 이미 저장된 기존 이관 데이터가 일반 신청서로 보이게 되므로 변경하지 않습니다.
 */
public final class MigrationApprovalMarker {

    /** 이관으로 생성된 결재완료 기록임을 등록자결재요청내용에 남기는 고정 문구입니다. */
    public static final String NOTE = "수기 엑셀 이관으로 생성된 결재완료 기록입니다. 실제 결재선을 거치지 않았습니다.";

    private MigrationApprovalMarker() {
        throw new UnsupportedOperationException("상수 컨테이너 — 인스턴스화 금지");
    }

    /**
     * 등록자결재요청내용이 이관 표식인지 판정합니다.
     *
     * @param rgprDcdReqCone 등록자결재요청내용. null이면 false
     * @return 이관으로 생성된 결재완료 기록이면 true
     */
    public static boolean isMigrated(String rgprDcdReqCone) {
        return NOTE.equals(rgprDcdReqCone);
    }
}
```

- [ ] **Step 4: Stamper가 공용 상수를 쓰게 바꾼다**

`MigrationApprovalStamper.java`에서 private 상수 선언을 지운다.

```java
    /** 이관으로 생성된 결재완료 기록임을 등록자결재요청내용에 남기는 고정 문구입니다. */
    private static final String MIGRATION_NOTE = "수기 엑셀 이관으로 생성된 결재완료 기록입니다. 실제 결재선을 거치지 않았습니다.";
```

import를 더한다.

```java
import com.kdb.it.common.approval.domain.MigrationApprovalMarker;
```

`Capplm.builder()` 안의 사용처를 바꾼다.

```java
                        .rgprDcdReqCone(MigrationApprovalMarker.NOTE)
```

- [ ] **Step 5: 응답 DTO에 플래그를 더한다**

`ApplicationDto.java`의 `Response` 클래스에 필드를 더한다. `rqsOpnn` 필드 선언 바로 뒤에 놓는다.

```java
        /**
         * 편성요청서 반입으로 만들어진 결재완료 기록이면 true.
         *
         * <p>이 값이 true면 신청서 본문이 없으므로 화면은 신청서 PDF 대신 반입 원본 파일 목록을 보여줍니다.
         */
        @Schema(description = "편성요청서 반입 생성 여부")
        private boolean migrated;
```

같은 파일 상단에 import를 더한다.

```java
import com.kdb.it.common.approval.domain.MigrationApprovalMarker;
```

`fromReadViews`의 빌더 체인에서 `.rqsOpnn(...)` 다음 줄에 더한다.

```java
                    .migrated(MigrationApprovalMarker.isMigrated(view.getRgprDcdReqCone()))
```

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*ApplicationResponseMigratedTest*"`
Expected: 3 tests PASS

- [ ] **Step 7: 기존 테스트가 깨지지 않았는지 확인한다**

Run: `cd it_backend && ./gradlew test`
Expected: BUILD SUCCESSFUL. 실패하면 대부분 OpenAPI 스냅샷 계약 테스트이므로 스냅샷을 갱신한다.

- [ ] **Step 8: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/common/approval/domain/MigrationApprovalMarker.java src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java src/main/java/com/kdb/it/domain/migration/service/MigrationApprovalStamper.java src/test/java/com/kdb/it/common/approval/dto/ApplicationResponseMigratedTest.java
```

```bash
git -C it_backend commit -m "feat: 신청서 조회 응답에 편성요청서 반입 여부 플래그 추가"
```

---

### Task 2: 물리 파일을 공유하는 첨부 재연결

같은 엑셀을 여러 신청서번호에 붙여야 하는데, `uploadFile`을 반복 호출하면 디스크에 같은 파일이
여러 벌 쌓인다. 이미 저장된 물리 파일을 가리키는 메타행만 추가하는 경로를 만든다.

물리 파일을 공유해도 안전한 근거는 삭제가 논리 삭제이기 때문이다 — `FileService.deleteFile`과
`deleteFilesByOrc`는 `DEL_YN='Y'`만 세우고 디스크를 건드리지 않는다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileUploadUnitService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/service/FileServiceLinkExistingTest.java`

**Interfaces:**
- Consumes: `FileRepository.findByFlMpnIdAndDelYn(String, String)`, `FileRepository.getNextSequenceValue()` (둘 다 기존)
- Produces:
  - `FileUploadUnitService.linkExistingFileInNewTransaction(Cfilem source, FileDto.UploadRequest request)` → `Cfilem`
  - `FileService.linkExistingFile(String sourceFlMpnId, FileDto.UploadRequest request)` → `String` (새 파일매핑ID)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`it_backend/src/test/java/com/kdb/it/infra/file/service/FileServiceLinkExistingTest.java`:

```java
package com.kdb.it.infra.file.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import com.kdb.it.common.board.service.BoardPostFileCacheService;
import com.kdb.it.exception.CustomGeneralException;
import com.kdb.it.infra.file.FileOwnershipChecker;
import com.kdb.it.infra.file.dto.FileDto;
import com.kdb.it.infra.file.entity.Cfilem;
import com.kdb.it.infra.file.repository.FileRepository;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FileServiceLinkExistingTest {

    private final FileRepository fileRepository = mock(FileRepository.class);
    private final FileOwnershipChecker fileOwnershipChecker = mock(FileOwnershipChecker.class);
    private final FileUploadUnitService fileUploadUnitService = mock(FileUploadUnitService.class);
    private final BoardPostFileCacheService boardPostFileCacheService =
            mock(BoardPostFileCacheService.class);

    private final FileService fileService =
            new FileService(
                    fileRepository,
                    fileOwnershipChecker,
                    fileUploadUnitService,
                    boardPostFileCacheService);

    private FileDto.UploadRequest request() {
        return FileDto.UploadRequest.builder()
                .flTpCone("첨부파일")
                .pkColNm("편성요청서반입")
                .pkCone("APF-2026-00000002")
                .build();
    }

    @Test
    @DisplayName("원본 파일의 물리 경로를 공유하는 메타행을 만들고 새 파일매핑ID를 돌려준다")
    void linkExistingFile_reusesPhysicalFile() {
        Cfilem source =
                Cfilem.builder()
                        .flMpnId("FL-00000001")
                        .flNm("편성요청서.xlsx")
                        .flPysNm("SVR1_20260818120000_abc.xlsx")
                        .flKpnPth("/data/files/편성요청서반입/2026/08")
                        .flTpCone("첨부파일")
                        .apgFlSz(2048L)
                        .pkColNm("편성요청서반입")
                        .pkCone("APF-2026-00000001")
                        .build();
        Cfilem linked = Cfilem.builder().flMpnId("FL-00000002").build();

        given(fileRepository.findByFlMpnIdAndDelYn("FL-00000001", "N"))
                .willReturn(Optional.of(source));
        given(fileUploadUnitService.linkExistingFileInNewTransaction(any(), any()))
                .willReturn(linked);

        String flMpnId = fileService.linkExistingFile("FL-00000001", request());

        assertThat(flMpnId).isEqualTo("FL-00000002");
    }

    @Test
    @DisplayName("원본이 없으면 업무 예외를 던진다")
    void linkExistingFile_throwsWhenSourceMissing() {
        given(fileRepository.findByFlMpnIdAndDelYn("FL-99999999", "N"))
                .willReturn(Optional.empty());

        assertThatThrownBy(() -> fileService.linkExistingFile("FL-99999999", request()))
                .isInstanceOf(CustomGeneralException.class)
                .hasMessageContaining("FL-99999999");
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*FileServiceLinkExistingTest*"`
Expected: 컴파일 실패 — `linkExistingFile`, `linkExistingFileInNewTransaction` 심볼 없음

주: `FileService`의 생성자 인자 순서는 `@RequiredArgsConstructor`가 필드 선언 순서로 만든다.
현재 순서는 `fileRepository`, `fileOwnershipChecker`, `fileUploadUnitService`,
`boardPostFileCacheService`다. 컴파일이 이 지점에서 어긋나면 필드 선언 순서를 다시 확인한다.

- [ ] **Step 3: 단위 서비스에 재연결 메서드를 더한다**

`FileUploadUnitService.java`의 `uploadFileInNewTransaction` 바로 아래에 더한다.

```java
    /**
     * 이미 저장된 물리 파일을 다른 부모에 추가로 연결합니다.
     *
     * <p>디스크에 다시 쓰지 않고 메타데이터 행만 만듭니다. 같은 파일을 여러 원장에 붙여야 하는 편성요청서 반입이
     * 이 경로를 씁니다. 삭제가 논리 삭제({@code DEL_YN='Y'})라 물리 파일을 공유해도 형제 행의 다운로드가 깨지지
     * 않는다는 전제 위에 있습니다. 물리 삭제를 도입하면 이 메서드도 함께 고쳐야 합니다.
     *
     * @param source 원본 파일 메타데이터. 파일물리명·저장경로·파일명·크기를 그대로 물려받습니다
     * @param request 새 연결의 종류와 부모 식별자
     * @return 새로 만들어진 파일 메타데이터 엔티티
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Cfilem linkExistingFileInNewTransaction(Cfilem source, FileDto.UploadRequest request) {
        Cfilem linked =
                Cfilem.builder()
                        .flMpnId(generateFlMpnId())
                        .flNm(source.getFlNm())
                        .flPysNm(source.getFlPysNm())
                        .flKpnPth(source.getFlKpnPth())
                        .flTpCone(request.getFlTpCone())
                        .apgFlSz(source.getApgFlSz())
                        .pkCone(request.getPkCone())
                        .pkColNm(request.getPkColNm())
                        .build();

        entityManager.persist(linked);
        entityManager.flush();
        return linked;
    }
```

- [ ] **Step 4: 서비스에 진입점을 더한다**

`FileService.java`의 `uploadFileAndGet` 바로 아래에 더한다.

```java
    /**
     * 이미 저장된 파일을 다른 부모에 추가로 연결합니다.
     *
     * <p>물리 파일을 다시 쓰지 않고 메타데이터 행만 만듭니다. 같은 파일이 여러 부모에 붙어야 할 때 {@link
     * #uploadFile} 반복 호출 대신 씁니다.
     *
     * @param sourceFlMpnId 원본 파일매핑ID
     * @param request 새 연결의 종류와 부모 식별자
     * @return 새로 만들어진 파일매핑ID
     * @throws CustomGeneralException 원본 파일이 없거나 이미 삭제된 경우
     */
    @Transactional
    public String linkExistingFile(String sourceFlMpnId, FileDto.UploadRequest request) {
        Cfilem source =
                fileRepository
                        .findByFlMpnIdAndDelYn(sourceFlMpnId, "N")
                        .orElseThrow(
                                () ->
                                        new CustomGeneralException(
                                                "존재하지 않는 파일입니다. 파일매핑ID: " + sourceFlMpnId));

        Cfilem linked = fileUploadUnitService.linkExistingFileInNewTransaction(source, request);
        syncBoardFileCacheIfNeeded(request.getPkColNm(), request.getPkCone());
        return linked.getFlMpnId();
    }
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*FileServiceLinkExistingTest*"`
Expected: 2 tests PASS

- [ ] **Step 6: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/infra/file/service/FileService.java src/main/java/com/kdb/it/infra/file/service/FileUploadUnitService.java src/test/java/com/kdb/it/infra/file/service/FileServiceLinkExistingTest.java
```

```bash
git -C it_backend commit -m "feat: 물리 파일을 공유하는 첨부 재연결 경로 추가"
```

---

### Task 3: 반입 결과에 신청서번호 싣기

파일을 어느 신청서번호에 붙일지 알아야 한다. 지금 `MigrationApprovalStamper.stamp`가 신청서번호를
돌려주지만 `RequestFormFileImporter`가 버리고 있다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/dto/RequestFormDto.java:263-269`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporterTest.java` (기존 파일 수정)

**Interfaces:**
- Consumes: `MigrationApprovalStamper.stamp(...)` → `String apfDcmNo` (기존 반환값)
- Produces: `RequestFormDto.CreatedRecord(String table, String key, String label, String apfMngNo)`
  — 인자 4개짜리 record. Task 4가 `apfMngNo()`를 읽는다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

기존 `RequestFormFileImporterTest.java`에 아래 테스트를 더한다. 파일 상단 import에
`static org.assertj.core.api.Assertions.assertThat`이 이미 있으면 다시 넣지 않는다.

```java
    @Test
    @DisplayName("생성된 원장에 반입 받이 신청서번호가 실린다")
    void apply_carriesApprovalNumber() {
        given(approvalStamper.stamp(any(), any(), any(), any(), any(), any()))
                .willReturn("APF-2026-00000007");

        RequestFormDto.FileResult result =
                importer.apply(outputWithOneProject(), entry(), "2026", "E001");

        assertThat(result.created())
                .singleElement()
                .extracting(RequestFormDto.CreatedRecord::apfMngNo)
                .isEqualTo("APF-2026-00000007");
    }
```

주: `outputWithOneProject()`와 `entry()`는 이 테스트 파일에 이미 있는 헬퍼를 쓴다.
이름이 다르면 파일에 있는 동등한 헬퍼로 바꾼다. 없으면 사업 1건짜리 `FormAdapterOutput`과
`FileEntry`를 만드는 헬퍼를 이 테스트 파일 안에 새로 만든다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormFileImporterTest*"`
Expected: 컴파일 실패 — `CreatedRecord::apfMngNo` 메서드 없음

- [ ] **Step 3: DTO에 필드를 더한다**

`RequestFormDto.java`의 `CreatedRecord`를 바꾼다.

```java
    /**
     * 반입으로 만들어진 원장 1건입니다.
     *
     * @param table 원천테이블명 (`BPROJM` 또는 `BCOSTM`)
     * @param key 관리번호
     * @param label 표시명
     * @param apfMngNo 이 원장에 붙인 반입 받이 신청서번호. 결재현황에서 반입 원본 파일을 찾는 키입니다
     */
    @Schema(name = "RequestFormCreatedRecord", description = "생성된 원장")
    public record CreatedRecord(
            @Schema(description = "원천테이블명", requiredMode = Schema.RequiredMode.REQUIRED)
                    String table,
            @Schema(description = "관리번호", requiredMode = Schema.RequiredMode.REQUIRED) String key,
            @Schema(description = "표시명", requiredMode = Schema.RequiredMode.REQUIRED)
                    String label,
            @Schema(description = "반입 받이 신청서번호", requiredMode = Schema.RequiredMode.REQUIRED)
                    String apfMngNo) {}
```

- [ ] **Step 4: 임포터가 신청서번호를 흘려보내게 바꾼다**

`RequestFormFileImporter.java`의 private `stamp` 메서드가 신청서번호를 반환하게 바꾼다.

```java
    private String stamp(String table, String key, String label, String actorEno, String bseYy) {
        return approvalStamper.stamp(
                table,
                key,
                SOURCE_SEQUENCE,
                "%s %s".formatted(APPROVAL_TITLE_PREFIX, label == null ? key : label),
                actorEno,
                bseYy);
    }
```

`apply` 메서드의 사업 루프에서 반환값을 받아 `CreatedRecord`에 싣는다.

```java
            String apfMngNo = stamp(TABLE_PROJECT, abusMngNo, project.getAbusNm(), actorEno, bseYy);
            created.add(
                    new RequestFormDto.CreatedRecord(
                            TABLE_PROJECT, abusMngNo, project.getAbusNm(), apfMngNo));
```

전산업무비 루프도 같이 바꾼다.

```java
            String apfMngNo = stamp(TABLE_COST, costBgNo, cost.getCttNm(), actorEno, bseYy);
            created.add(
                    new RequestFormDto.CreatedRecord(
                            TABLE_COST, costBgNo, cost.getCttNm(), apfMngNo));
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormFileImporterTest*"`
Expected: 모든 테스트 PASS. 인자 3개짜리 `CreatedRecord` 생성이 남아 있으면 컴파일 오류가 나므로 4개로 고친다.

- [ ] **Step 6: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/dto/RequestFormDto.java src/main/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporter.java src/test/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporterTest.java
```

```bash
git -C it_backend commit -m "feat: 반입 결과에 반입 받이 신청서번호 포함"
```

---

### Task 4: 반입 원본 파일 보존

부점 폴더 단위로 묶어, APPLIED 파일을 그 폴더에서 생성된 모든 신청서번호에 연결한다.
파일당 디스크 기록은 1회이고 나머지 연결은 Task 2의 재연결 경로를 쓴다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiver.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormImportService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiverTest.java`

**Interfaces:**
- Consumes: `FileService.uploadFile(MultipartFile, FileDto.UploadRequest)` → `String`,
  `FileService.linkExistingFile(String, FileDto.UploadRequest)` → `String` (Task 2),
  `RequestFormDto.CreatedRecord.apfMngNo()` (Task 3)
- Produces:
  - `RequestFormSourceFileArchiver.PK_COL_NM` — `String` 상수 `"편성요청서반입"` (Task 5가 참조)
  - `RequestFormSourceFileArchiver.archive(List<MultipartFile> files, RequestFormDto.ImportManifest manifest, List<RequestFormDto.FileResult> results)` → `void`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiverTest.java`:

```java
package com.kdb.it.domain.migration.request.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;

import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.infra.file.dto.FileDto;
import com.kdb.it.infra.file.service.FileService;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

class RequestFormSourceFileArchiverTest {

    private final FileService fileService = mock(FileService.class);
    private final RequestFormSourceFileArchiver archiver =
            new RequestFormSourceFileArchiver(fileService);

    private MultipartFile file(String name) {
        return new MockMultipartFile("files", name, null, new byte[] {1, 2, 3});
    }

    private RequestFormDto.FileEntry entry(String fileKey, String deptName) {
        return new RequestFormDto.FileEntry(fileKey, deptName, null, null, null);
    }

    private RequestFormDto.FileResult result(
            String fileKey,
            String deptName,
            RequestFormDto.FileStatus status,
            List<String> apfMngNos) {
        List<RequestFormDto.CreatedRecord> created = new ArrayList<>();
        for (String apfMngNo : apfMngNos) {
            created.add(
                    new RequestFormDto.CreatedRecord("BPROJM", "ABUS-" + apfMngNo, "사업", apfMngNo));
        }
        return new RequestFormDto.FileResult(
                fileKey,
                deptName,
                status,
                List.of(),
                List.copyOf(created),
                new RequestFormDto.RecordCounts(1, 0, 0),
                null);
    }

    private RequestFormDto.ImportManifest manifest(List<RequestFormDto.FileEntry> entries) {
        return new RequestFormDto.ImportManifest("2026", List.copyOf(entries), List.of());
    }

    @Test
    @DisplayName("같은 부점 폴더의 파일은 그 폴더가 만든 모든 신청서번호에 붙는다")
    void archive_linksEveryApplicationInSameFolder() {
        List<MultipartFile> files = List.of(file("a.xlsx"), file("b.xlsx"));
        List<RequestFormDto.FileEntry> entries =
                List.of(
                        entry("IT부(D01)/a.xlsx", "IT부(D01)"),
                        entry("IT부(D01)/b.xlsx", "IT부(D01)"));
        List<RequestFormDto.FileResult> results =
                List.of(
                        result(
                                "IT부(D01)/a.xlsx",
                                "IT부(D01)",
                                RequestFormDto.FileStatus.APPLIED,
                                List.of("APF-1")),
                        result(
                                "IT부(D01)/b.xlsx",
                                "IT부(D01)",
                                RequestFormDto.FileStatus.APPLIED,
                                List.of("APF-2")));

        given(fileService.uploadFile(any(), any())).willReturn("FL-00000001", "FL-00000002");

        archiver.archive(files, manifest(entries), results);

        // 파일 2개 × 신청서 2건 = 연결 4개. 디스크 기록은 파일당 1회이므로 upload 2회, link 2회
        then(fileService).should(times(2)).uploadFile(any(), any());
        then(fileService).should(times(2)).linkExistingFile(any(), any());
    }

    @Test
    @DisplayName("다른 부점 폴더의 파일은 서로 섞이지 않는다")
    void archive_doesNotCrossFolders() {
        List<MultipartFile> files = List.of(file("a.xlsx"), file("b.xlsx"));
        List<RequestFormDto.FileEntry> entries =
                List.of(
                        entry("IT부(D01)/a.xlsx", "IT부(D01)"),
                        entry("총무부(D02)/b.xlsx", "총무부(D02)"));
        List<RequestFormDto.FileResult> results =
                List.of(
                        result(
                                "IT부(D01)/a.xlsx",
                                "IT부(D01)",
                                RequestFormDto.FileStatus.APPLIED,
                                List.of("APF-1")),
                        result(
                                "총무부(D02)/b.xlsx",
                                "총무부(D02)",
                                RequestFormDto.FileStatus.APPLIED,
                                List.of("APF-2")));

        given(fileService.uploadFile(any(), any())).willReturn("FL-00000001", "FL-00000002");

        archiver.archive(files, manifest(entries), results);

        ArgumentCaptor<FileDto.UploadRequest> captor =
                ArgumentCaptor.forClass(FileDto.UploadRequest.class);
        then(fileService).should(times(2)).uploadFile(any(), captor.capture());
        then(fileService).should(never()).linkExistingFile(any(), any());
        assertThat(captor.getAllValues())
                .extracting(FileDto.UploadRequest::getPkCone)
                .containsExactlyInAnyOrder("APF-1", "APF-2");
    }

    @Test
    @DisplayName("BLOCKED 파일은 보관하지 않는다")
    void archive_skipsBlockedFiles() {
        List<MultipartFile> files = List.of(file("a.xlsx"));
        List<RequestFormDto.FileEntry> entries = List.of(entry("IT부(D01)/a.xlsx", "IT부(D01)"));
        List<RequestFormDto.FileResult> results =
                List.of(
                        result(
                                "IT부(D01)/a.xlsx",
                                "IT부(D01)",
                                RequestFormDto.FileStatus.BLOCKED,
                                List.of()));

        archiver.archive(files, manifest(entries), results);

        then(fileService).should(never()).uploadFile(any(), any());
        then(fileService).should(never()).linkExistingFile(any(), any());
    }

    @Test
    @DisplayName("파일 종류는 편성요청서반입으로 고정한다")
    void archive_usesFixedFileKind() {
        List<MultipartFile> files = List.of(file("a.xlsx"));
        List<RequestFormDto.FileEntry> entries = List.of(entry("IT부(D01)/a.xlsx", "IT부(D01)"));
        List<RequestFormDto.FileResult> results =
                List.of(
                        result(
                                "IT부(D01)/a.xlsx",
                                "IT부(D01)",
                                RequestFormDto.FileStatus.APPLIED,
                                List.of("APF-1")));

        given(fileService.uploadFile(any(), any())).willReturn("FL-00000001");

        archiver.archive(files, manifest(entries), results);

        ArgumentCaptor<FileDto.UploadRequest> captor =
                ArgumentCaptor.forClass(FileDto.UploadRequest.class);
        then(fileService).should().uploadFile(any(), captor.capture());
        assertThat(captor.getValue().getPkColNm()).isEqualTo("편성요청서반입");
        assertThat(captor.getValue().getFlTpCone()).isEqualTo("첨부파일");
    }

    @Test
    @DisplayName("파일 저장이 실패해도 예외를 밖으로 던지지 않는다")
    void archive_swallowsStorageFailure() {
        List<MultipartFile> files = List.of(file("a.xlsx"));
        List<RequestFormDto.FileEntry> entries = List.of(entry("IT부(D01)/a.xlsx", "IT부(D01)"));
        List<RequestFormDto.FileResult> results =
                List.of(
                        result(
                                "IT부(D01)/a.xlsx",
                                "IT부(D01)",
                                RequestFormDto.FileStatus.APPLIED,
                                List.of("APF-1")));

        given(fileService.uploadFile(any(), any())).willThrow(new RuntimeException("디스크 오류"));

        assertThatCode(() -> archiver.archive(files, manifest(entries), results))
                .doesNotThrowAnyException();
    }
}
```

주: `RequestFormDto.ImportManifest`의 생성자 인자 순서(`bseYy`, `entries`, `overrides`)와
`FileEntry`의 인자 5개(`fileKey`, `deptName`, `deptCodeOverride`, `generalExpenseUnit`,
`bgUntAbusC`)는 `RequestFormDto.java`에서 다시 확인한다. 다르면 실제 선언에 맞춘다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormSourceFileArchiverTest*"`
Expected: 컴파일 실패 — `RequestFormSourceFileArchiver` 클래스 없음

- [ ] **Step 3: 보존 서비스를 만든다**

`it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiver.java`:

```java
package com.kdb.it.domain.migration.request.service;

import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.infra.file.dto.FileDto;
import com.kdb.it.infra.file.service.FileService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * 반입한 편성요청서 원본을 공통첨부파일에 보관합니다.
 *
 * <p>보관 단위는 <b>부점 폴더</b>입니다. 한 폴더의 파일은 그 폴더가 만든 모든 원장에서 함께 보여야 하므로, 폴더가 만든
 * 신청서번호마다 연결을 만듭니다. 다만 디스크 기록은 <b>파일당 1회</b>이고 두 번째 연결부터는 물리 경로를 공유하는
 * 메타행만 추가합니다({@link FileService#linkExistingFile}).
 *
 * <p>APPLIED 파일만 보관합니다. BLOCKED·FAILED 파일은 원장을 만들지 않아 붙일 신청서번호가 없고, 같은 폴더의 정상
 * 건에 얹으면 그 사업과 무관한 실패 파일이 목록에 섞입니다. 반입 실패는 반입 화면의 진단이 다룹니다.
 *
 * <p>이 클래스는 <b>예외를 밖으로 던지지 않습니다</b>. 원장 반영이 이미 커밋된 뒤에 실행되므로, 보관 실패로 반입 전체를
 * 실패로 돌리면 되돌릴 수 없는 원장이 남은 채 사용자에게 실패로 보입니다. 보관에 실패한 건은 파일이 0건인 상태가 되어
 * 화면에서 안내 문구로 흐르며, 원인은 ERROR 로그로 남습니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RequestFormSourceFileArchiver {

    /** 공통첨부파일 주식별자컬럼명. 이 값이 반입 원본 파일 종류의 단일 출처입니다. */
    public static final String PK_COL_NM = "편성요청서반입";

    /** 공통첨부파일 파일유형내용. 반입 원본은 이미지가 아니라 첨부파일입니다. */
    private static final String FL_TP_CONE = "첨부파일";

    private final FileService fileService;

    /**
     * 반입 배치의 원본 파일을 부점 폴더 단위로 보관합니다.
     *
     * <p>호출자는 commit 경로에서만 부릅니다. dry-run은 원장을 만들지 않으므로 보관할 대상도 없습니다.
     *
     * @param files 업로드 파일. {@code manifest.entries()}와 순서로 짝지어집니다
     * @param manifest 파일별 부가 정보
     * @param results 파일별 반영 결과. {@code fileKey}로 manifest 항목과 이어집니다
     */
    public void archive(
            List<MultipartFile> files,
            RequestFormDto.ImportManifest manifest,
            List<RequestFormDto.FileResult> results) {
        Map<String, RequestFormDto.FileResult> resultByFileKey = new LinkedHashMap<>();
        for (RequestFormDto.FileResult result : results) {
            resultByFileKey.put(result.fileKey(), result);
        }

        // 부점 폴더별로 (보관할 파일 목록, 그 폴더가 만든 신청서번호 집합)을 모은다
        Map<String, List<MultipartFile>> filesByDept = new LinkedHashMap<>();
        Map<String, Set<String>> apfMngNosByDept = new LinkedHashMap<>();

        for (int i = 0; i < files.size() && i < manifest.entries().size(); i++) {
            RequestFormDto.FileEntry entry = manifest.entries().get(i);
            RequestFormDto.FileResult result = resultByFileKey.get(entry.fileKey());
            if (result == null || result.status() != RequestFormDto.FileStatus.APPLIED) {
                continue;
            }
            String dept = entry.deptName();
            filesByDept.computeIfAbsent(dept, key -> new ArrayList<>()).add(files.get(i));
            Set<String> apfMngNos =
                    apfMngNosByDept.computeIfAbsent(dept, key -> new LinkedHashSet<>());
            for (RequestFormDto.CreatedRecord created : result.created()) {
                if (created.apfMngNo() != null) {
                    apfMngNos.add(created.apfMngNo());
                }
            }
        }

        for (Map.Entry<String, List<MultipartFile>> group : filesByDept.entrySet()) {
            Set<String> apfMngNos = apfMngNosByDept.getOrDefault(group.getKey(), Set.of());
            if (apfMngNos.isEmpty()) {
                continue;
            }
            for (MultipartFile file : group.getValue()) {
                archiveOne(file, apfMngNos, group.getKey());
            }
        }
    }

    /**
     * 파일 1건을 폴더가 만든 모든 신청서번호에 연결합니다.
     *
     * <p>첫 신청서번호에만 디스크에 쓰고, 나머지는 그 물리 파일을 공유하는 메타행만 만듭니다.
     */
    private void archiveOne(MultipartFile file, Set<String> apfMngNos, String deptName) {
        String sourceFlMpnId = null;
        for (String apfMngNo : apfMngNos) {
            try {
                if (sourceFlMpnId == null) {
                    sourceFlMpnId = fileService.uploadFile(file, request(apfMngNo));
                } else {
                    fileService.linkExistingFile(sourceFlMpnId, request(apfMngNo));
                }
            } catch (RuntimeException e) {
                // 보관 실패가 이미 커밋된 원장을 되돌리게 두지 않는다. 해당 건은 파일 0건 상태로 남는다
                log.error(
                        "편성요청서 반입 원본 보관 실패: deptName={}, apfMngNo={}, fileName={}",
                        deptName,
                        apfMngNo,
                        file.getOriginalFilename(),
                        e);
            }
        }
    }

    private FileDto.UploadRequest request(String apfMngNo) {
        return FileDto.UploadRequest.builder()
                .flTpCone(FL_TP_CONE)
                .pkColNm(PK_COL_NM)
                .pkCone(apfMngNo)
                .build();
    }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormSourceFileArchiverTest*"`
Expected: 5 tests PASS

- [ ] **Step 5: 반입 서비스에 연결한다**

`RequestFormImportService.java`에 필드를 더한다. 이 클래스는 명시적 생성자를 쓰므로
생성자 인자에도 함께 더한다(파일 43번째 줄 부근의 생성자).

```java
    private final RequestFormSourceFileArchiver sourceFileArchiver;
```

`importBatch`의 반환 직전을 바꾼다. 기존 코드는 다음과 같다.

```java
        return new RequestFormDto.ImportResponse(
                dryRun, summarize(files.size(), results), List.copyOf(results));
```

아래로 바꾼다.

```java
        // 원장 반영(파일별 REQUIRES_NEW)이 모두 끝난 뒤에 보관한다. 순서를 뒤집으면 첨부 실패가
        // 정상 반입을 통째로 되돌린다. 보관은 예외를 던지지 않으므로 여기서 감싸지 않는다
        if (!dryRun) {
            sourceFileArchiver.archive(files, manifest, results);
        }

        return new RequestFormDto.ImportResponse(
                dryRun, summarize(files.size(), results), List.copyOf(results));
```

- [ ] **Step 6: dry-run이 보관하지 않는지 테스트한다**

`it_backend/src/test/java/com/kdb/it/domain/migration/request/service/`의 기존
`RequestFormImportService` 테스트에 더한다. 해당 테스트 파일이 없으면
`RequestFormImportServiceArchiveTest.java`를 새로 만들고, 그 파일의 다른 테스트가 쓰는
생성자 인자 구성을 그대로 따른다.

```java
    @Test
    @DisplayName("dry-run은 원본을 보관하지 않는다")
    void dryRun_doesNotArchive() {
        service.importBatch(List.of(file("a.xlsx")), manifest, "E001", true);

        then(sourceFileArchiver).should(never()).archive(any(), any(), any());
    }

    @Test
    @DisplayName("commit은 원본을 보관한다")
    void commit_archives() {
        service.importBatch(List.of(file("a.xlsx")), manifest, "E001", false);

        then(sourceFileArchiver).should().archive(any(), any(), any());
    }
```

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*RequestForm*"`
Expected: 모든 테스트 PASS

- [ ] **Step 8: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiver.java src/main/java/com/kdb/it/domain/migration/request/service/RequestFormImportService.java src/test/java/com/kdb/it/domain/migration/request/service/
```

```bash
git -C it_backend commit -m "feat: 편성요청서 반입 원본 파일 보관"
```

---

### Task 5: 반입 원본 파일 열람 권한

`FileReadAuthorizerRegistry`는 미등록 종류를 관리자 전용으로 default-deny 한다. 해당 부점
사용자도 자기 부점 제출본을 볼 수 있어야 하므로 판정기를 등록한다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/infra/file/authz/RequestFormFileReadAuthorizer.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/repository/ApplicationMapRepository.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/authz/RequestFormFileReadAuthorizerTest.java`

**Interfaces:**
- Consumes: `RequestFormSourceFileArchiver.PK_COL_NM` (Task 4),
  `ProjectRepository.findById(BprojmId)`, `CostRepository.findById(BcostmId)`,
  `CustomUserDetails.isAdmin()`, `CustomUserDetails.getBbrC()`
- Produces:
  - `ApplicationMapRepository.findByApfDcmNo(String apfDcmNo)` → `List<Cappla>`
  - `RequestFormFileReadAuthorizer` 빈 (레지스트리가 자동 수집)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`it_backend/src/test/java/com/kdb/it/infra/file/authz/RequestFormFileReadAuthorizerTest.java`:

```java
package com.kdb.it.infra.file.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kdb.it.common.approval.entity.Cappla;
import com.kdb.it.common.approval.repository.ApplicationMapRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.budget.cost.entity.Bcostm;
import com.kdb.it.domain.budget.cost.entity.BcostmId;
import com.kdb.it.domain.budget.cost.repository.CostRepository;
import com.kdb.it.domain.budget.project.entity.Bprojm;
import com.kdb.it.domain.budget.project.entity.BprojmId;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RequestFormFileReadAuthorizerTest {

    private final ApplicationMapRepository applicationMapRepository =
            mock(ApplicationMapRepository.class);
    private final ProjectRepository projectRepository = mock(ProjectRepository.class);
    private final CostRepository costRepository = mock(CostRepository.class);
    private final RequestFormFileReadAuthorizer authorizer =
            new RequestFormFileReadAuthorizer(
                    applicationMapRepository, projectRepository, costRepository);

    private Cfilem file(String apfMngNo) {
        Cfilem f = mock(Cfilem.class);
        when(f.getPkCone()).thenReturn(apfMngNo);
        return f;
    }

    private Cappla map(String fntTbNm, String pk) {
        Cappla cappla = mock(Cappla.class);
        when(cappla.getFntTbNm()).thenReturn(fntTbNm);
        when(cappla.getPkColNm()).thenReturn(pk);
        when(cappla.getFntTbCrySno()).thenReturn(1);
        return cappla;
    }

    private Bprojm project(String svnDpmC) {
        Bprojm bprojm = mock(Bprojm.class);
        when(bprojm.getSvnDpmC()).thenReturn(svnDpmC);
        return bprojm;
    }

    @Test
    @DisplayName("편성요청서반입 종류를 담당한다")
    void supports_requestFormKind() {
        assertThat(authorizer.supportedPkColNms()).containsExactly("편성요청서반입");
    }

    @Test
    @DisplayName("미인증은 읽을 수 없다")
    void anonymous_cannotRead() {
        assertThat(authorizer.canRead(file("APF-1"), null)).isFalse();
    }

    @Test
    @DisplayName("관리자는 원장 조회 없이 읽을 수 있다")
    void admin_canRead() {
        CustomUserDetails admin = new CustomUserDetails("A001", List.of("ITPAD001"), "D99");

        assertThat(authorizer.canRead(mock(Cfilem.class), admin)).isTrue();
    }

    @Test
    @DisplayName("사업 주관부서가 같은 사용자는 읽을 수 있다")
    void sameProjectDepartment_canRead() {
        CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "D01");
        given(applicationMapRepository.findByApfDcmNo("APF-1"))
                .willReturn(List.of(map("BPROJM", "ABUS-1")));
        given(projectRepository.findById(new BprojmId("ABUS-1", 1)))
                .willReturn(Optional.of(project("D01")));

        assertThat(authorizer.canRead(file("APF-1"), user)).isTrue();
    }

    @Test
    @DisplayName("다른 부점 사용자는 읽을 수 없다")
    void otherDepartment_cannotRead() {
        CustomUserDetails user = new CustomUserDetails("E002", List.of("ITPZZ001"), "D02");
        given(applicationMapRepository.findByApfDcmNo("APF-1"))
                .willReturn(List.of(map("BPROJM", "ABUS-1")));
        given(projectRepository.findById(new BprojmId("ABUS-1", 1)))
                .willReturn(Optional.of(project("D01")));

        assertThat(authorizer.canRead(file("APF-1"), user)).isFalse();
    }

    @Test
    @DisplayName("전산업무비도 담당부서로 판정한다")
    void costDepartment_canRead() {
        CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "D01");
        Bcostm bcostm = mock(Bcostm.class);
        when(bcostm.getSvnDpmC()).thenReturn("D01");
        given(applicationMapRepository.findByApfDcmNo("APF-2"))
                .willReturn(List.of(map("BCOSTM", "CTT-1")));
        given(costRepository.findById(new BcostmId("CTT-1", 1))).willReturn(Optional.of(bcostm));

        assertThat(authorizer.canRead(file("APF-2"), user)).isTrue();
    }

    @Test
    @DisplayName("연결된 원장을 찾지 못하면 읽을 수 없다")
    void missingLedger_cannotRead() {
        CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "D01");
        given(applicationMapRepository.findByApfDcmNo("APF-3")).willReturn(List.of());

        assertThat(authorizer.canRead(file("APF-3"), user)).isFalse();
    }

    @Test
    @DisplayName("부모 신청서번호가 비어 있으면 읽을 수 없다")
    void blankParent_cannotRead() {
        CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "D01");

        assertThat(authorizer.canRead(file(null), user)).isFalse();
    }
}
```

주: `BcostmId`의 생성자 인자는 `(bgNo, bgSno)`다. `Bcostm`의 복합키 필드명이 다르면
`it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/BcostmId.java`의 실제
선언에 맞춘다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormFileReadAuthorizerTest*"`
Expected: 컴파일 실패 — `RequestFormFileReadAuthorizer`, `findByApfDcmNo` 심볼 없음

- [ ] **Step 3: 리포지토리 조회 메서드를 더한다**

`ApplicationMapRepository.java`에 더한다.

```java
    /**
     * 신청서번호로 연결된 원장 매핑을 모두 조회합니다.
     *
     * <p>반입 원본 파일의 열람 권한 판정이 씁니다 — 파일의 부모는 신청서번호이고, 판정 기준은 그 신청서가 가리키는
     * 원장의 주관부서이기 때문입니다.
     *
     * @param apfDcmNo 신청서식별번호
     * @return 연결된 매핑 목록. 없으면 빈 목록
     */
    java.util.List<Cappla> findByApfDcmNo(String apfDcmNo);
```

- [ ] **Step 4: 판정기를 만든다**

`it_backend/src/main/java/com/kdb/it/infra/file/authz/RequestFormFileReadAuthorizer.java`:

```java
package com.kdb.it.infra.file.authz;

import com.kdb.it.common.approval.entity.Cappla;
import com.kdb.it.common.approval.repository.ApplicationMapRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.budget.cost.entity.BcostmId;
import com.kdb.it.domain.budget.cost.repository.CostRepository;
import com.kdb.it.domain.budget.project.entity.BprojmId;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.migration.request.service.RequestFormSourceFileArchiver;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 편성요청서 반입 원본 파일 읽기 판정기.
 *
 * <p>{@code PK_CONE}가 반입 받이 신청서번호이므로, 그 신청서가 가리키는 원장({@code TPRMPP_CAPPLA})의
 * 주관부서({@code SVN_DPM_C})를 사용자 부서({@code bbrC})와 비교한다.
 *
 * <ul>
 *   <li>관리자 → 허용
 *   <li>연결된 원장의 주관부서가 사용자 부서와 같으면 허용
 *   <li>그 외(미인증, 부모 없음, 원장 없음) → 거부
 * </ul>
 *
 * <p>판정은 {@code (PK_COL_NM, PK_CONE, user)}의 순수 함수라는 {@link FileReadAuthorizer}의 불변식을
 * 지킨다 — 개별 파일의 다른 속성을 보지 않는다.
 */
@Component
@RequiredArgsConstructor
public class RequestFormFileReadAuthorizer implements FileReadAuthorizer {

    /** 원천테이블명: 정보화사업·경상사업 마스터. */
    private static final String TABLE_PROJECT = "BPROJM";

    /** 원천테이블명: 전산업무비 마스터. */
    private static final String TABLE_COST = "BCOSTM";

    private final ApplicationMapRepository applicationMapRepository;
    private final ProjectRepository projectRepository;
    private final CostRepository costRepository;

    @Override
    public Set<String> supportedPkColNms() {
        return Set.of(RequestFormSourceFileArchiver.PK_COL_NM);
    }

    /**
     * 반입 원본 파일 읽기 가능 여부.
     *
     * @param file 대상 파일. 부모는 {@code PK_CONE}의 반입 받이 신청서번호
     * @param user 현재 사용자. null이면 비인증 → 불가
     * @return 관리자이거나 연결 원장의 주관부서가 사용자 부서와 같으면 true
     */
    @Override
    public boolean canRead(Cfilem file, CustomUserDetails user) {
        if (user == null) {
            return false;
        }
        if (user.isAdmin()) {
            return true;
        }
        String apfMngNo = file.getPkCone();
        if (!StringUtils.hasText(apfMngNo) || !StringUtils.hasText(user.getBbrC())) {
            return false;
        }
        return applicationMapRepository.findByApfDcmNo(apfMngNo).stream()
                .anyMatch(map -> user.getBbrC().equals(departmentOf(map)));
    }

    /** 매핑이 가리키는 원장의 주관부서코드. 찾지 못하면 null. */
    private String departmentOf(Cappla map) {
        String table = map.getFntTbNm();
        String key = map.getPkColNm();
        Integer sno = map.getFntTbCrySno();
        if (!StringUtils.hasText(table) || !StringUtils.hasText(key) || sno == null) {
            return null;
        }
        if (TABLE_PROJECT.equals(table)) {
            return projectRepository
                    .findById(new BprojmId(key, sno))
                    .map(project -> project.getSvnDpmC())
                    .orElse(null);
        }
        if (TABLE_COST.equals(table)) {
            return costRepository
                    .findById(new BcostmId(key, sno))
                    .map(cost -> cost.getSvnDpmC())
                    .orElse(null);
        }
        return null;
    }
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormFileReadAuthorizerTest*"`
Expected: 8 tests PASS

- [ ] **Step 6: 레지스트리 중복 등록이 없는지 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*FileReadAuthorizerRegistryTest*"`
Expected: PASS. 실패하면 다른 판정기가 이미 `편성요청서반입`을 선언한 것이므로 종류 이름을 정리한다.

- [ ] **Step 7: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/infra/file/authz/RequestFormFileReadAuthorizer.java src/main/java/com/kdb/it/common/approval/repository/ApplicationMapRepository.java src/test/java/com/kdb/it/infra/file/authz/RequestFormFileReadAuthorizerTest.java
```

```bash
git -C it_backend commit -m "feat: 반입 원본 파일 열람 권한 판정기 추가"
```

- [ ] **Step 8: 백엔드 품질 게이트를 돌린다**

Run: `cd it_backend && ./gradlew check`
Expected: BUILD SUCCESSFUL

---

### Task 6: 결재현황 다이얼로그에 파일 목록 표시

**Files:**
- Create: `it_frontend/app/components/migration/RequestFormSourceFiles.vue`
- Modify: `it_frontend/app/components/layout/ApplicationViewerDialog.vue`
- Modify: `it_frontend/i18n/messages/layout.ts`
- Modify: `it_frontend/tests/unit/architecture/component-boundaries.test.ts:77-87`
- Test: `it_frontend/tests/unit/components/migration/RequestFormSourceFiles.test.ts`
- Test: `it_frontend/tests/unit/components/ApplicationViewerDialogMigrated.test.ts`

**Interfaces:**
- Consumes: `GET /api/applications/{apfMngNo}` 응답의 `migrated: boolean` (Task 1),
  `useFiles().fetchFilesBatch(pkColNm, pkCones)` → `Promise<Record<string, FileRecord[]>>` (기존),
  `useFiles().getDownloadUrl(fileOrId)` → `string` (기존)
- Produces: `RequestFormSourceFiles.vue` — props `{ files: FileRecord[] }`

- [ ] **Step 1: 프론트 타입을 백엔드 스펙과 맞춘다**

Run: `cd it_frontend && npm run codegen:check`
Expected: `migrated` 필드 드리프트로 FAIL. 프로젝트의 생성 스크립트로 타입을 재생성한 뒤 다시 돌려 PASS를 확인한다.

- [ ] **Step 2: 파일 목록 컴포넌트의 실패하는 테스트를 쓴다**

`it_frontend/tests/unit/components/migration/RequestFormSourceFiles.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import RequestFormSourceFiles from '~/components/migration/RequestFormSourceFiles.vue';

vi.mock('~/composables/useFiles', () => ({
    useFiles: () => ({
        getDownloadUrl: (file: { flMpnId: string }) => `/api/files/${file.flMpnId}/download`,
    }),
}));

const mountWith = (files: unknown[]) =>
    mount(RequestFormSourceFiles, {
        props: { files },
        global: { stubs: { Message: true } },
    });

describe('RequestFormSourceFiles', () => {
    it('파일 2건을 모두 그린다', () => {
        const wrapper = mountWith([
            { flMpnId: 'FL-00000001', flNm: '편성요청서_IT부.xlsx', apgFlSz: 2048 },
            { flMpnId: 'FL-00000002', flNm: '편성요청서_IT부_2.xlsx', apgFlSz: 4096 },
        ]);

        expect(wrapper.text()).toContain('편성요청서_IT부.xlsx');
        expect(wrapper.text()).toContain('편성요청서_IT부_2.xlsx');
    });

    it('파일명 링크가 다운로드 URL을 가리킨다', () => {
        const wrapper = mountWith([
            { flMpnId: 'FL-00000001', flNm: '편성요청서_IT부.xlsx', apgFlSz: 2048 },
        ]);

        expect(wrapper.find('a').attributes('href')).toBe('/api/files/FL-00000001/download');
    });

    it('목록이 비면 안내를 낸다', () => {
        const wrapper = mountWith([]);

        expect(wrapper.find('a').exists()).toBe(false);
        expect(wrapper.html()).toContain('message-stub');
    });
});
```

주: 이 저장소의 컴포넌트 테스트는 `~/` 별칭과 i18n 전역 주입 방식이 파일마다 조금씩 다르다.
`it_frontend/tests/unit/components/`의 인접 테스트 하나를 열어 `global` 설정을 그대로 맞춘다.
특히 `useI18n`을 전역 스텁으로 넣는 방식이 파일마다 다르므로, 마운트가 `t is not a function`으로
깨지면 그 파일의 설정을 복사한다.

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

Run: `cd it_frontend && npx vitest run tests/unit/components/migration/RequestFormSourceFiles.test.ts`
Expected: FAIL — 컴포넌트 파일을 찾을 수 없음

- [ ] **Step 4: i18n 문구를 더한다**

`it_frontend/i18n/messages/layout.ts`의 **한국어** `viewer` 블록에 더한다.

```ts
                sourceFilesTitle: '반입 원본 파일',
                sourceFilesEmpty: '보관된 업로드 파일이 없습니다.',
                sourceFilesFailed: '반입 원본 파일을 불러오지 못했습니다.',
                sourceFileDownload: '{name} 내려받기',
```

같은 파일의 **영어** `viewer` 블록에도 더한다.

```ts
                sourceFilesTitle: 'Imported source files',
                sourceFilesEmpty: 'No uploaded file is stored for this record.',
                sourceFilesFailed: 'The imported source files could not be loaded.',
                sourceFileDownload: 'Download {name}',
```

- [ ] **Step 5: 파일 목록 컴포넌트를 만든다**

`it_frontend/app/components/migration/RequestFormSourceFiles.vue`:

```vue
<!--
================================================================================
[components/migration/RequestFormSourceFiles.vue] 반입 원본 파일 목록
================================================================================
편성요청서 반입으로 만들어진 원장의 업로드 원본 엑셀 목록을 보여줍니다.

[책임 경계]
  이 컴포넌트는 표시와 다운로드 링크만 담당합니다. 어떤 신청서가 반입 건인지 판별하고
  파일을 조회하는 일은 부모(ApplicationViewerDialog)가 합니다.

[Props]
  - files : 표시할 파일 목록. 빈 배열이면 안내 문구를 냅니다
================================================================================
-->
<script setup lang="ts">
import Message from 'primevue/message';
import { useFiles } from '~/composables/useFiles';
import type { FileRecord } from '~/composables/useFiles';

defineProps<{
    /** 표시할 반입 원본 파일 목록 */
    files: FileRecord[];
}>();

const { t } = useI18n({ useScope: 'global' });
const { getDownloadUrl } = useFiles();

/**
 * 바이트 크기를 사람이 읽는 단위로 바꿉니다.
 * @param size - 파일 크기(바이트). null·undefined면 빈 문자열
 */
const formatSize = (size?: number | null): string => {
    if (size === null || size === undefined) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
</script>

<template>
    <div class="w-full h-full overflow-auto p-6">
        <Message v-if="files.length === 0" severity="info" :closable="false">
            {{ t('layout.viewer.sourceFilesEmpty') }}
        </Message>

        <ul v-else class="flex flex-col gap-2">
            <li
                v-for="file in files"
                :key="file.flMpnId"
                class="flex items-center gap-3 rounded border border-zinc-200 dark:border-zinc-700 px-4 py-3"
            >
                <i class="pi pi-file-excel text-emerald-600 dark:text-emerald-400" />
                <a
                    :href="getDownloadUrl(file)"
                    :title="t('layout.viewer.sourceFileDownload', { name: file.flNm })"
                    class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    download
                >
                    {{ file.flNm }}
                </a>
                <span class="ml-auto text-sm text-zinc-500 dark:text-zinc-400">
                    {{ formatSize(file.apgFlSz) }}
                </span>
            </li>
        </ul>
    </div>
</template>
```

- [ ] **Step 6: 컴포넌트 테스트가 통과하는지 확인한다**

Run: `cd it_frontend && npx vitest run tests/unit/components/migration/RequestFormSourceFiles.test.ts`
Expected: 3 tests PASS

- [ ] **Step 7: 경계 테스트를 갱신한다**

`it_frontend/tests/unit/architecture/component-boundaries.test.ts`의 migration 목록에 더한다.

```ts
                'MigrationFileSlots.vue',
                'MigrationPreviewTable.vue',
                'RequestFormFolderPicker.vue',
                'RequestFormGuide.vue',
                'RequestFormResultTable.vue',
                'RequestFormSourceFiles.vue',
```

Run: `cd it_frontend && npx vitest run tests/unit/architecture/component-boundaries.test.ts`
Expected: PASS

- [ ] **Step 8: 뷰어 분기의 실패하는 테스트를 쓴다**

`it_frontend/tests/unit/components/ApplicationViewerDialogMigrated.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ApplicationViewerDialog from '~/components/layout/ApplicationViewerDialog.vue';

const fetchApplication = vi.fn();
const fetchFilesBatch = vi.fn();
const renderApprovalForm = vi.fn();

vi.mock('~/composables/useApprovals', () => ({
    useApprovals: () => ({ fetchApplication }),
}));
vi.mock('~/composables/useFiles', () => ({
    useFiles: () => ({ fetchFilesBatch, getDownloadUrl: () => '/download' }),
}));
vi.mock('~/composables/useApprovalFormRenderer', () => ({
    useApprovalFormRenderer: () => ({ renderApprovalForm }),
}));

const mountViewer = (apfMngNo: string) =>
    mount(ApplicationViewerDialog, {
        props: { visible: true, apfMngNo },
        global: { stubs: { Dialog: { template: '<div><slot /></div>' } } },
    });

describe('ApplicationViewerDialog 반입 건 분기', () => {
    it('반입 건이면 PDF를 만들지 않고 파일 목록을 조회한다', async () => {
        fetchApplication.mockResolvedValue({
            apfMngNo: 'APF-2026-00000001',
            migrated: true,
            apfDtlCone: null,
        });
        fetchFilesBatch.mockResolvedValue({
            'APF-2026-00000001': [
                { flMpnId: 'FL-00000001', flNm: '편성요청서.xlsx', apgFlSz: 2048 },
            ],
        });

        const wrapper = mountViewer('APF-2026-00000001');
        await flushPromises();

        expect(renderApprovalForm).not.toHaveBeenCalled();
        expect(fetchFilesBatch).toHaveBeenCalledWith('편성요청서반입', ['APF-2026-00000001']);
        expect(wrapper.text()).toContain('편성요청서.xlsx');
    });

    it('반입 건인데 파일이 0건이면 안내를 낸다', async () => {
        fetchApplication.mockResolvedValue({
            apfMngNo: 'APF-2026-00000001',
            migrated: true,
            apfDtlCone: null,
        });
        fetchFilesBatch.mockResolvedValue({ 'APF-2026-00000001': [] });

        const wrapper = mountViewer('APF-2026-00000001');
        await flushPromises();

        expect(renderApprovalForm).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain('보관된 업로드 파일이 없습니다.');
    });

    it('일반 신청서는 기존 PDF 경로를 그대로 탄다', async () => {
        fetchApplication.mockResolvedValue({
            apfMngNo: 'APF-2026-00000002',
            migrated: false,
            apfDtlCone: '{"form":{"id":"itBudget"}}',
            apfStsC: '03',
        });
        renderApprovalForm.mockResolvedValue('blob:pdf');

        mountViewer('APF-2026-00000002');
        await flushPromises();

        expect(fetchFilesBatch).not.toHaveBeenCalled();
        expect(renderApprovalForm).toHaveBeenCalled();
    });
});
```

주: 두 번째 테스트의 단언은 i18n이 실제 한국어 문구를 내는 설정을 전제로 한다. 이 저장소의
테스트 i18n 스텁이 키를 그대로 돌려주는 방식이면 `'layout.viewer.sourceFilesEmpty'`로 바꾼다.
인접 테스트 하나를 열어 어느 쪽인지 먼저 확인한다.

- [ ] **Step 9: 테스트가 실패하는지 확인한다**

Run: `cd it_frontend && npx vitest run tests/unit/components/ApplicationViewerDialogMigrated.test.ts`
Expected: FAIL — `fetchFilesBatch`가 호출되지 않고 `renderApprovalForm`이 호출됨

- [ ] **Step 10: 뷰어에 분기를 넣는다**

`ApplicationViewerDialog.vue`의 `<script setup>`에 import를 더한다.

```ts
import RequestFormSourceFiles from '~/components/migration/RequestFormSourceFiles.vue';
import { useFiles } from '~/composables/useFiles';
import type { FileRecord } from '~/composables/useFiles';
```

상태를 더한다.

```ts
/**
 * 반입 원본 파일의 공통첨부파일 종류(PK_COL_NM).
 * 백엔드 `RequestFormSourceFileArchiver.PK_COL_NM`과 같은 값이어야 합니다. 사용자에게 보이는 문구가 아니라
 * API 질의 키이므로 i18n 대상이 아닙니다.
 */
const SOURCE_FILE_KIND = '편성요청서반입';

const { fetchFilesBatch } = useFiles();

/** 반입 건 여부. true면 신청서 PDF 대신 원본 파일 목록을 보여줍니다. */
const isMigrated = ref(false);
/** 반입 원본 파일 목록. 반입 건이 아니면 빈 배열입니다. */
const sourceFiles = ref<FileRecord[]>([]);
```

`viewerName` computed를 반입 건에서 제목이 바뀌도록 바꾼다.

```ts
/** 다이얼로그 이름. 반입 건은 신청서가 아니라 원본 파일을 보여주므로 제목도 갈립니다. */
const viewerName = computed(() =>
    isMigrated.value ? t('layout.viewer.sourceFilesTitle') : t('layout.viewer.title'),
);
```

`watch(() => props.visible, ...)`의 상태 초기화 블록(`loading.value = true` 부근)에 두 줄을 더한다.

```ts
        isMigrated.value = false;
        sourceFiles.value = [];
```

같은 watch의 `try` 블록에서 `fetchApplication` 호출 다음에 분기를 넣는다.
기존 코드는 다음과 같다.

```ts
            const approval = await fetchApplication(props.apfMngNo);

            if (!approval?.apfDtlCone) {
                errorKey.value = 'layout.viewer.missingDetails';
                return;
            }
```

아래로 바꾼다.

```ts
            const approval = await fetchApplication(props.apfMngNo);

            /* 반입 건은 신청서 본문이 없다. PDF 대신 업로드 원본 파일 목록을 보여준다 */
            if (approval?.migrated) {
                isMigrated.value = true;
                try {
                    const byParent = await fetchFilesBatch(SOURCE_FILE_KIND, [props.apfMngNo]);
                    sourceFiles.value = byParent[props.apfMngNo] ?? [];
                } catch (fileError) {
                    console.error('[ApplicationViewer] 반입 원본 파일 조회 실패:', fileError);
                    errorKey.value = 'layout.viewer.sourceFilesFailed';
                }
                return;
            }

            if (!approval?.apfDtlCone) {
                errorKey.value = 'layout.viewer.missingDetails';
                return;
            }
```

`<template>`의 로딩·오류 분기 다음, PDF iframe 앞에 목록 분기를 넣는다.

```vue
            <!-- 반입 건: 신청서 PDF 대신 업로드 원본 파일 목록 -->
            <RequestFormSourceFiles v-else-if="isMigrated" :files="sourceFiles" />
```

- [ ] **Step 11: 테스트가 통과하는지 확인한다**

Run: `cd it_frontend && npx vitest run tests/unit/components/ApplicationViewerDialogMigrated.test.ts`
Expected: 3 tests PASS

- [ ] **Step 12: 프론트 게이트를 돌린다**

```bash
cd it_frontend && npm run format:check && npm run check && npm test && npm run codegen:check
```

Expected: 전부 PASS. `check:copy` ratchet이 새 리터럴을 잡으면 i18n 키로 옮긴다.

- [ ] **Step 13: 커밋**

```bash
git -C it_frontend add app/components/migration/RequestFormSourceFiles.vue app/components/layout/ApplicationViewerDialog.vue i18n/messages/layout.ts tests/unit/architecture/component-boundaries.test.ts tests/unit/components/migration/RequestFormSourceFiles.test.ts tests/unit/components/ApplicationViewerDialogMigrated.test.ts
```

```bash
git -C it_frontend commit -m "feat: 결재현황에서 반입 원본 파일 목록 표시"
```

`npm run codegen:check`가 생성 타입 파일을 바꿨다면 그 경로도 같은 커밋에 명시해 더한다.

---

## 마무리

- [ ] **버전 잠금 갱신**

세 저장소를 함께 바꿨으므로 호환 커밋 조합을 갱신한다.

```bash
pwsh -File scripts/update-versions-lock.ps1
```

- [ ] **수동 확인**

두 서버를 띄우고 `/admin/migration/requests`에서 부점 폴더(엑셀 2개 이상)를 반입한 뒤,
`/budget/list`와 `/approval`에서 그 건의 신청서를 열어 파일 2건이 모두 보이고 다운로드가
되는지 확인한다. 반입 이전에 만들어진 건도 열어 안내 문구가 나오는지 확인한다.
관리자가 아닌 다른 부점 계정으로도 열어 목록이 비는지 확인한다.
