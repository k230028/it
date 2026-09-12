# 가이드 콘텐츠 개발→운영 이관 Implementation Plan

> **상태(2026-09-12): 보류.** Task 1(`DOC_DTL_ITM_C` 문서 유형 분류)만 `V20260907_002`로 실현됐고, Task 2~11이 약속한 `it_backend` `domain/migration/guidecontent` 패키지·ZIP 번들 API·프론트 화면은 착수되지 않았다(워킹트리에 해당 패키지 없음). 가이드 콘텐츠의 개발→운영 이관은 현재 사업 가이드 문서를 운영에서 직접 등록하는 방식으로 운영 중이며, 재개하려면 [설계](../specs/2026-09-01-guide-content-migration-design.md)를 `BgdocDocumentType`·`BgdocNumberAllocator`·`FileStoragePathPolicy`(2026-09-03 이후 신설) 기준으로 다시 검토한 뒤 이 계획을 갱신한다. 그 전까지 이 문서를 구현 사실로 읽지 않는다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 공통 데이터 xlsx 계약을 유지하면서 입력 길라잡이와 선택한 사업 가이드를 문서·첨부·이미지·Excalidraw 장면까지 완결된 ZIP으로 개발에서 운영에 반복 이관하고, 선택한 운영 집합은 동일한 경우를 제외하고 개발본으로 원자적으로 덮어쓴다.

**Architecture:** `domain/migration/guidecontent`가 저장된 가이드 집합을 원본 ID와 무관한 portable aggregate로 변환하고 ZIP v1을 읽고 쓴다. dry-run과 commit은 같은 `BundleReader → Planner` 경로를 사용하며, commit만 운영 파일 ID를 선채번하고 새 물리 파일을 만든 뒤 `TransactionTemplate`의 단일 DB 트랜잭션에서 BGDOCM/CFILEM을 교체한다. 프론트는 기존 xlsx 상태를 건드리지 않고 입력 길라잡이와 사업 가이드에 독립 composable 인스턴스를 둔다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Data JPA, Oracle/Flyway, jsoup, Jackson, Apache Commons Compress 1.27.1, Nuxt 4, Vue 3, TypeScript 6, PrimeVue, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-01-guide-content-migration-design.md`

## Global Constraints

- 기존 `/api/admin/migration/common-data` JSON/xlsx 계약과 `useCommonDataMigrationPage`는 변경하지 않는다. 새 API 기본 경로는 `/api/admin/migration/guide-content`다.
- `FDOC-*`와 `GDOC-*`를 한 ZIP에 섞지 않는다. `BNOTE-*`, 논리삭제 원본, 선택하지 않은 가이드는 export와 commit에서 제외한다.
- 논리 키는 FDOC/GDOC 모두 `DOC_TTL_CONE` 정확 일치값이다. FDOC는 `FormGuideCatalog`에 반드시 존재해야 하고 GDOC는 새 함수 기반 유일 인덱스로 활성 제목 유일성을 보장한다.
- 이관 대상 운영 집합은 개발본이 우선이다. 활성 문서는 같은 운영 `DOC_MNG_NO`를 유지하고, 삭제 문서 한 건은 부활하며, 없는 문서는 운영 시퀀스로 생성한다. ZIP에 없는 운영 가이드는 삭제하지 않는다.
- 활성 후보가 둘 이상이면 차단한다. 활성 후보가 없을 때 삭제 후보가 둘 이상이어도 차단한다. 활성 한 건과 과거 삭제 이력이 함께 있으면 활성 건만 재사용하고 삭제 이력은 그대로 둔다.
- `UNCHANGED`는 portable canonical aggregate SHA-256이 같을 때만 반환하고 BGDOCM/CFILEM/물리 파일을 전혀 쓰지 않는다.
- 원본 `DOC_MNG_NO`, `FL_MPN_ID`, GUID, 감사 컬럼, 물리 경로·물리명은 운영 PK나 저장값으로 복사하지 않는다.
- 같은 원본 파일이 여러 가이드에서 참조돼도 대상에서는 가이드마다 새 CFILEM 행과 새 물리 파일을 만든다.
- 파일 역할이 겹치면 결정적 우선순위 `EXCALIDRAW_SCENE > EXCALIDRAW_IMAGE > IMAGE > ATTACHMENT`를 적용한다. 장면 파일의 canonical `size`는 portable JSON UTF-8 바이트 수이고, 대상 CFILEM의 `APG_FL_SZ`는 재압축된 실제 `.lzstr` 바이트 수다.
- portable HTML은 `migfile://`를 실제 또는 검사용 파일 ID로 치환한 뒤 `HtmlSanitizer`에 넣는다. 정화 뒤 참조 집합이 정확히 보존되지 않으면 dry-run/commit을 차단한다.
- ZIP 한 건은 all-or-nothing이다. 부분 성공, 서버 임시 job, sticky session, dry-run 결과 재사용을 도입하지 않는다.
- ZIP 제한 기본값은 bundle 200 MiB, entry 50 MiB, 압축 해제 합계 512 MiB, entry 2,000개다. 일반 공통 파일 업로드 한도는 기존 50 MiB로 유지한다.
- `FileUploadUnitService`의 `REQUIRES_NEW` 메서드를 호출하지 않는다. 새 물리 파일 쓰기와 DB 트랜잭션을 이관 서비스가 조정하고 DB 실패 시 이번 요청 파일만 보상 삭제한다.
- 대상 CFILEM의 kind는 항상 `가이드문서`로 저장해 기존 `GuideDocFileReadAuthorizer`의 인증 사용자 읽기 계약을 그대로 적용한다.
- 관리자 행위 로그에는 제목, HTML, 원본 파일명, 파일 바이트를 넣지 않는다. operation, actor, bundle SHA-256, bundleType, 가이드/파일 수, 총 바이트, 성공 여부만 기록한다.
- 신규 JavaDoc/TSDoc/인라인 주석은 한글로 작성하고, API DTO 변경 뒤 생성 타입을 직접 편집하지 말고 `npm run codegen`으로 `app/types/api.d.ts`를 갱신한다.
- 세 하위 저장소는 독립 Git 저장소다. 각 Task의 커밋은 해당 저장소에서 경로를 명시해 수행하고, 무관한 워킹트리 변경은 스테이징하지 않는다.

---

### Task 1: GDOC 논리 키 유일성 선행 마이그레이션

**Files:**
- Modify: `it_database/migrations/V20260903_005__NormalizeBgdocIndexes.sql`
- Create: `it_database/docs/verification/V20260903_005__NormalizeBgdocIndexes.verify.sql`
- Create: `it_database/docs/operations/2026-09-03-bgdoc-namespace-index-handover.md`

**Interfaces:** BE-97의 `V20260903_004__NormalizeBgdocNamespaces.sql` 이후
`V20260903_005__NormalizeBgdocIndexes.sql`이 활성 `GDOC-%` 행의
`DOC_TTL_CONE` 유일성을 `IX_TPRMPP_BGDOCM_04`로 보장한다. 같은 버전은 담당자
`CDOC-*`를 `_02`, 공통 팝업 `PDOC-*`를 `_03`으로 정규화한다. 진단 출력은
제목·본문 없이 건수와 기술 키만 제공한다.

- [x] **Step 1: 기존 계획의 별도 `V20260901_001` 생성을 철회한다**

버전 `20260901.001`과 `UX_BGDOCM_GDOC_TITLE`은 생성하지 않는다. 새 인덱스는
`meta/index.txt`의 `IX_TPRMPP_{테이블약어}_{2자리 순번}` 명명 규칙을 따라야
한다.

- [x] **Step 2: 중복 사전 차단·기존 표준명 계약 검증을 포함한다**

`V20260903_005`는 `_02`~`_04`가 이미 있으면 `ALL_INDEXES`와
`ALL_IND_EXPRESSIONS`에서 UNIQUE 여부와 정규화된 함수식을 검증하고, 다른
계약이면 DDL 전에 실패한다. 활성 CDOC 담당자, PDOC 공통 팝업, GDOC 제목의
중복 그룹도 DDL 전에 차단한다.

- [ ] **Step 3: DBA 또는 local-int에서 적용과 검증 SQL을 실행한다**

Run: `@docs/verification/V20260903_005__NormalizeBgdocIndexes.verify.sql`

Expected: 구 UX 인덱스는 0건, `_02`~`_04`는 각각 UNIQUE 1건, 함수식은
운영 인계 표와 일치, 세 중복 그룹 수는 0, Flyway version `20260903.005`는
success다. 적용 이력이 있으면 파일을 수정하지 않고 운영 인계의 실패·복구 분기를
따른다.

### Task 2: 공통 파일 검증과 안전한 저장 경로 정책 추출

**Files:**
- Modify: `it_backend/build.gradle`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/FileValidator.java`
- Create: `it_backend/src/main/java/com/kdb/it/infra/file/storage/FileStoragePathPolicy.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileUploadUnitService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/FileValidatorTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/infra/file/storage/FileStoragePathPolicyTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/infra/file/service/FileUploadUnitServiceTest.java`

**Interfaces:** 일반 업로드는 `validateUpload(filename, size)`로 50 MiB 상한을 유지한다. 이관은 같은 확장자/파일명 정책과 `FileStoragePathPolicy`의 기준경로 포함 검증, 저장 디렉터리, 고유 물리명 생성을 직접 재사용한다.

- [ ] **Step 1: 경로 이탈·파일 크기 회귀 테스트를 작성한다**

```java
@Test
void 일반_업로드는_50MiB를_초과하면_거부한다() {
    assertThatThrownBy(() -> validator.validateUpload("guide.pdf", 50L * 1024 * 1024 + 1))
            .isInstanceOf(CustomGeneralException.class);
}

@Test
void 이관_물리명은_요청_UUID를_포함하고_기준경로_안에만_생성된다() {
    UUID requestId = UUID.fromString("12345678-1234-1234-1234-123456789abc");
    StoredFileTarget target = policy.newMigrationTarget("가이드문서", "scene.lzstr", requestId);
    assertThat(target.absolutePath()).startsWith(basePath.toAbsolutePath().normalize());
    assertThat(target.physicalName()).matches("SVR1_MIG_12345678123412341234123456789abc_[0-9a-f]{32}\\.lzstr");
}
```

- [ ] **Step 2: focused test가 red인지 확인한다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*FileValidatorTest' --tests '*FileStoragePathPolicyTest' --tests '*FileUploadUnitServiceTest'
```

Expected: FAIL because size API and storage policy are absent.

- [ ] **Step 3: 파일 정책을 구현하고 기존 업로드에 연결한다**

`FileValidator` 공개 계약:

```java
public static final long DEFAULT_MAX_UPLOAD_BYTES = 50L * 1024 * 1024;

public void validateUpload(String filename, long size) {
    validateExtension(filename);
    if (size < 0 || size > DEFAULT_MAX_UPLOAD_BYTES) {
        throw new CustomGeneralException("파일 크기가 허용 범위를 초과했습니다.");
    }
    if (Utf8ByteLimit.length(filename) > 100) {
        throw new CustomGeneralException("파일명이 저장 가능 길이를 초과했습니다.");
    }
}
```

`FileStoragePathPolicy` 공개 계약:

```java
public record StoredFileTarget(
        Path directory, Path absolutePath, String physicalName, String storedDirectory) {}

public Path resolveExisting(String storedDirectory, String physicalName);
public StoredFileTarget newUploadTarget(String kind, String originalName);
public StoredFileTarget newMigrationTarget(String kind, String originalName, UUID requestId);
public boolean isMigrationPhysicalName(String physicalName);
public Path requireInsideBase(Path candidate);
```

정책은 `app.file.base-path`, `app.server.instance-id`, `Clock`을 주입받고 `가이드문서/년/월` 디렉터리를 만든다. 업로드 물리명은 기존 형식을 유지하고, 이관 물리명은 `{instance}_MIG_{requestUuid32}_{fileUuid32}.{lowercaseExt}`로 만든다. `FileUploadUnitService`는 `buildStorageDir`와 `generateFlPysNm`의 중복을 제거하고 기존 `Files.copy(source, target, REPLACE_EXISTING)` 대신 새 고유 경로에 `CREATE_NEW`를 사용한다. `FileService`의 다운로드 경로도 `resolveExisting`을 사용한다.

Commons Compress를 코드에서 직접 사용할 예정이므로 전이 의존에 기대지 않고 현재 해석 버전을 명시한다.

```groovy
implementation 'org.apache.commons:commons-compress:1.27.1'
```

- [ ] **Step 4: 공통 파일 테스트를 green으로 만든다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*FileValidatorTest' --tests '*FileStoragePathPolicyTest' --tests '*FileUploadUnitServiceTest' --tests '*FileServiceTest'
```

Expected: PASS. 기존 `.lzstr` 허용, 경로 이탈 거부, 50 MiB 상한, 기존 다운로드, 고유 파일 `CREATE_NEW`가 모두 통과한다.

- [ ] **Step 5: 백엔드 파일 인프라 변경을 커밋한다**

```powershell
cd C:\it\it_backend
git add build.gradle src/main/java/com/kdb/it/infra/file/FileValidator.java src/main/java/com/kdb/it/infra/file/storage/FileStoragePathPolicy.java src/main/java/com/kdb/it/infra/file/service/FileUploadUnitService.java src/main/java/com/kdb/it/infra/file/service/FileService.java src/test/java/com/kdb/it/infra/file/FileValidatorTest.java src/test/java/com/kdb/it/infra/file/storage/FileStoragePathPolicyTest.java src/test/java/com/kdb/it/infra/file/service/FileUploadUnitServiceTest.java
git diff --cached --stat
git commit -m "refactor: 파일 저장 경로 정책 공통화"
```

### Task 3: portable aggregate와 HTML·Excalidraw 참조 코덱

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/model/GuideContentBundle.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentLzStringCodec.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentReferenceCodec.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentCanonicalizer.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentLzStringCodecTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentReferenceCodecTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentCanonicalizerTest.java`

**Interfaces:** 저장된 ID를 portable `migfile://file-0001` 참조로 바꾸고 되돌리며, LZ-String Base64 장면을 frontend `lz-string@1.5.0`과 바이트 호환한다. canonical hash는 원본 PK, 생성시각, ZIP 순서와 무관하다.

- [ ] **Step 1: 프론트와 공유하는 golden LZ·참조 테스트를 작성한다**

```java
@Test
void frontend_lzString과_같은_Base64를_해제하고_재압축한다() {
    String encoded = "N4IgZglgNgpgziAXMAvioA==";
    assertThat(codec.decompressFromBase64(encoded)).isEqualTo("{\"files\":{}}");
    assertThat(codec.compressToBase64("{\"files\":{}}")).isEqualTo(encoded);
}

@Test
void HTML_문서순서대로_참조를_이식_ID로_바꾼다() {
    String html = "<img src=\"/api/files/FL-2/preview\"><span data-file-id=\"FL-1\"></span>";
    PortableHtml portable = codec.toPortableHtml(html);
    assertThat(portable.sourceFileIds()).containsExactly("FL-2", "FL-1");
    assertThat(portable.html()).contains("migfile://file-0001", "migfile://file-0002");
}
```

장면 테스트는 `files` 맵 입력 순서를 뒤집어도 키 오름차순으로 같은 portable JSON과 logical ID 순서를 만드는지 검증한다.

- [ ] **Step 2: codec 테스트가 red인지 확인한다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*GuideContentLzStringCodecTest' --tests '*GuideContentReferenceCodecTest' --tests '*GuideContentCanonicalizerTest'
```

Expected: FAIL because model and codecs are absent.

- [ ] **Step 3: ZIP v1 내부 모델과 완전한 LZ-String 호환 코덱을 구현한다**

`GuideContentBundle`은 Jackson record를 한 곳에 모은다.

```java
public final class GuideContentBundle {
    public enum BundleType { FORM_GUIDE, BUSINESS_GUIDE }
    public enum FileRole { ATTACHMENT, IMAGE, EXCALIDRAW_SCENE, EXCALIDRAW_IMAGE }
    public record Manifest(
            String format,
            int version,
            BundleType bundleType,
            Instant createdAt,
            List<GuideEntry> guides,
            List<FileEntry> files) {}
    public record GuideEntry(
            String entryId,
            String guideKey,
            String sourceDocMngNo,
            String documentPath,
            String aggregateSha256) {}
    public record FileEntry(
            String guideEntryId,
            String logicalFileId,
            String sourceFileId,
            FileRole role,
            String originalName,
            String fileType,
            long size,
            String blobSha256,
            String blobPath,
            String scenePath) {}
    public record GuideDocument(String guideKey, String title, String contentHtml) {}
}
```

`GuideContentLzStringCodec`는 JavaScript LZ-String의 Base64 경로(`bitsPerChar=6`, Base64 alphabet) 압축과 `resetValue=32` 해제 알고리즘을 Java로 완전히 이식한다. 새 Maven 의존성을 추가하지 않으며 null/잘못된 Base64/잘린 스트림은 빈 문자열로 숨기지 않고 `IllegalArgumentException`으로 구분한다.

- [ ] **Step 4: HTML과 장면의 양방향 참조 변환을 구현한다**

공개 계약:

```java
public List<HtmlReference> findHtmlReferences(String html);
public PortableHtml toPortableHtml(String html);
public String remapPortableHtml(String portableHtml, Map<String, String> logicalToTargetId);
public PortableScene toPortableScene(byte[] compressedScene, LogicalIdAllocator allocator);
public byte[] remapAndCompressScene(JsonNode portableScene, Map<String, String> logicalToTargetId);
public void requireNoPortableReference(String html, Collection<JsonNode> scenes);
```

지원 위치는 `data-file-id`, Excalidraw figure의 `data-attachment-id`, `src`/`href` 안의 `/api/files/{id}/preview|download`, 장면 `files.*.attachmentId`다. HTML은 jsoup DOM 순서, 장면 파일 맵은 key 오름차순으로 처리한다. URL은 경로 부분의 파일 ID만 바꾸고 query/fragment는 보존한다. 허용 위치 밖 텍스트나 속성의 `migfile://`는 오류다.

- [ ] **Step 5: canonical JSON과 aggregate SHA-256을 구현한다**

```java
public String aggregateSha256(PortableGuideAggregate aggregate) {
    byte[] canonical = objectMapper.writeValueAsBytes(toCanonicalTree(aggregate));
    return HexFormat.of().formatHex(messageDigest.digest(canonical));
}
```

canonical tree는 bundleType, guideKey, title, portable HTML, logicalFileId 오름차순 파일 메타데이터, JSON key 재귀 오름차순 장면을 포함하고 source ID/createdAt/entry 순서를 제외한다. 일반 파일 크기·SHA는 실제 blob으로 다시 계산하고, 장면 크기는 정규화 portable JSON UTF-8 바이트 수를 사용한다.

- [ ] **Step 6: codec/canonical 테스트를 green으로 만든다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*GuideContentLzStringCodecTest' --tests '*GuideContentReferenceCodecTest' --tests '*GuideContentCanonicalizerTest'
```

Expected: PASS for golden Base64, HTML 세 형식, 장면 키 정렬, 미해소 참조 거부, 원본 ID·시간·순서 무관 hash다.

- [ ] **Step 7: portable 코덱 변경을 커밋한다**

```powershell
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/migration/guidecontent/model/GuideContentBundle.java src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentLzStringCodec.java src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentReferenceCodec.java src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentCanonicalizer.java src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentLzStringCodecTest.java src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentReferenceCodecTest.java src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentCanonicalizerTest.java
git diff --cached --stat
git commit -m "feat: 가이드 이관 portable 참조 코덱 추가"
```

### Task 4: 안전한 ZIP v1 reader/writer

**Files:**
- Modify: `it_backend/src/main/resources/application.properties`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/config/GuideContentMigrationProperties.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/config/GuideContentMigrationConfig.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentBundleReader.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentBundleWriter.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentBundleReaderTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentBundleWriterTest.java`

**Interfaces:** multipart/ZIP을 요청별 임시 디렉터리에 제한 해제하고 선언·크기·해시를 검증한다. writer는 동일 v1 포맷을 결정적 entry 순서로 생성하며 200 MiB bundle 상한을 지킨다.

- [ ] **Step 1: 악성 ZIP과 정상 왕복 테스트를 작성한다**

테스트 표:

| 사례 | 기대 |
| --- | --- |
| `../escape`, `/absolute`, `C:/drive`, `a\\..\\b` | 거부 |
| 같은 entry 이름 2회 | 거부 |
| Unix symlink external attributes | 거부 |
| 2,001 entries | 거부 |
| entry 50 MiB + 1 byte | 거부 |
| 합계 512 MiB + 1 byte | 거부 |
| manifest 미선언 entry | 거부 |
| blob size/hash 불일치 | 거부 |
| FORM ZIP을 BUSINESS reader로 읽음 | 거부 |
| writer → reader | manifest/guide/blob/scene 동일 |

- [ ] **Step 2: bundle 테스트가 red인지 확인한다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*GuideContentBundleReaderTest' --tests '*GuideContentBundleWriterTest'
```

Expected: FAIL because reader/writer/properties are absent.

- [ ] **Step 3: 설정과 multipart 수용 한도를 구현한다**

```properties
app.migration.guide-content.max-bundle-bytes=200MB
app.migration.guide-content.max-entry-bytes=50MB
app.migration.guide-content.max-uncompressed-bytes=512MB
app.migration.guide-content.max-entry-count=2000
spring.servlet.multipart.max-file-size=200MB
spring.servlet.multipart.max-request-size=201MB
```

`GuideContentMigrationProperties`는 `DataSize` 네 값의 누락/0 이하를 위 기본값으로 보정한다. 일반 파일 API는 Task 2의 50 MiB `FileValidator.validateUpload`로 기존 한도를 유지한다.

- [ ] **Step 4: streaming ZIP 검증 reader를 구현한다**

```java
public ValidatedBundle read(MultipartFile file, BundleType expectedType) {
    Path requestDir = Files.createTempDirectory("itp-guide-import-");
    try {
        Path archive = copyAndHashWithinLimit(file, requestDir);
        ExtractedEntries entries = extractWithLimits(archive, requestDir.resolve("entries"));
        return validateContract(requestDir, archive, entries, expectedType);
    } catch (RuntimeException | IOException error) {
        deleteRecursivelyInsideTemp(requestDir);
        throw map(error);
    }
}
```

`ZipArchiveInputStream`으로 실제 읽은 바이트를 계수하고 `ZipArchiveEntry.isUnixSymlink()`를 검사한다. raw entry 이름에 `\\`, NUL, 절대경로, drive prefix, 빈 segment, `.`/`..` segment가 있으면 경로 생성 전에 거부한다. entry 이름은 `Set`으로 중복 검사하고 `CREATE_NEW`로만 쓴다. 전체 해제 후 허용 집합을 정확히 `manifest.json + documentPath + scenePath + blobPath`로 비교한다. blob 경로는 `blobs/{64자리 lowercase sha256}`와 같아야 한다.

`ValidatedBundle implements AutoCloseable`은 manifest, parsed documents/scenes, blob paths, raw bundle SHA-256, 총 바이트를 보유하고 close 시 자기 요청 temp만 지운다.

- [ ] **Step 5: 결정적 writer를 구현한다**

writer는 `manifest.json`, guide entryId 순서의 `guides/`, scenePath 순서의 `scenes/`, sha256 순서의 deduplicated `blobs/` 순으로 `ZipArchiveOutputStream`에 쓴다. entry timestamp는 0으로 고정한다. manifest의 `createdAt`은 실제 생성시각이라 ZIP 바이트는 달라질 수 있지만 aggregate hash와 entry 순서는 같아야 한다. export 임시 ZIP도 `AutoCloseable BundleArtifact`로 반환한다.

- [ ] **Step 6: ZIP 테스트를 green으로 만든다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*GuideContentBundleReaderTest' --tests '*GuideContentBundleWriterTest'
```

Expected: 모든 표 사례 PASS, 실패 후 temp 디렉터리 없음, 정상 artifact close 후 temp ZIP 없음.

- [ ] **Step 7: ZIP 계층을 커밋한다**

```powershell
cd C:\it\it_backend
git add src/main/resources/application.properties src/main/java/com/kdb/it/domain/migration/guidecontent/config src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentBundleReader.java src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentBundleWriter.java src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentBundleReaderTest.java src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentBundleWriterTest.java
git diff --cached --stat
git commit -m "feat: 가이드 이관 ZIP 검증 계층 추가"
```

### Task 5: 저장 가이드 집합 탐색과 선택 export

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/formguide/FormGuideCatalog.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/repository/GuideDocRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/repository/FileRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/dto/GuideContentCandidate.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentAggregateFactory.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentExporter.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentAggregateFactoryTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentExporterTest.java`

**Interfaces:** catalog/list 조회와 `export(BundleType, List<String> docMngNos)`를 제공한다. aggregate factory 하나를 export와 target 비교가 공유해 동일성 판정의 정규화 차이를 막는다.

- [ ] **Step 1: 범위·참조 폐쇄성·선택성 테스트를 작성한다**

```java
@Test
void 선택한_GDOC만_내보내고_BNOTE와_미선택_GDOC는_제외한다() {
    BundleArtifact artifact = exporter.export(BUSINESS_GUIDE, List.of("GDOC-2026-0002"));
    assertThat(readManifest(artifact).guides())
            .extracting(GuideEntry::sourceDocMngNo)
            .containsExactly("GDOC-2026-0002");
}

@Test
void 같은_원본파일을_공유한_두_가이드는_각자_논리파일을_가진다() {
    List<PortableGuideAggregate> aggregates = factory.buildAll(twoGuidesSharing("FL-1"));
    assertThat(aggregates).allSatisfy(aggregate ->
            assertThat(aggregate.files()).extracting(PortableFile::sourceFileId).contains("FL-1"));
}
```

누락 CFILEM, 삭제 파일, 빈 경로/물리명, unreadable blob, 잘못된 scene, catalog 밖 FDOC는 export 전체 실패인지 함께 검증한다.

- [ ] **Step 2: exporter 테스트가 red인지 확인한다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*GuideContentAggregateFactoryTest' --tests '*GuideContentExporterTest'
```

Expected: FAIL because aggregate factory/exporter/query methods are absent.

- [ ] **Step 3: bounded repository 조회와 catalog 전체 보기를 추가한다**

```java
List<Bgdocm> findAllByDocMngNoIn(Collection<String> docMngNos);
List<Bgdocm> findAllByDocTtlConeInAndDocMngNoStartingWith(
        Collection<String> docTtlCones, String prefix);
boolean existsByFlKpnPthAndFlPysNm(String flKpnPth, String flPysNm);
```

`FormGuideCatalog.entries()` overload는 INFO/COST 전체를 고정 catalog 순서로 반환한다. export 요청은 빈 목록, 500건 초과, 중복 ID를 거부하고, `IN` 조회 결과를 요청 ID 집합과 정확히 대조한다. 목록은 FDOC catalog 순서, GDOC `(docTtlCone, docMngNo)` 오름차순이다.

- [ ] **Step 4: aggregate factory를 구현한다**

```java
public PortableGuideAggregate build(BundleType type, Bgdocm guide) {
    List<HtmlReference> htmlRefs = referenceCodec.findHtmlReferences(guide.getNacTxtInf());
    Map<String, Cfilem> referenced = loadReferencedFiles(htmlRefs);
    List<Cfilem> owned = fileRepository
            .findAllByApgFlKdNmAndApgFlLnkCtzNmAndDelYn("가이드문서", guide.getDocMngNo(), "N");
    return closeReferencesAndCanonicalize(type, guide, htmlRefs, referenced, owned);
}
```

처리는 HTML 문서 순서 → scene 파일맵 key 순서 → 미참조 직접 소유 파일 `(fileType, originalName, blobSha256)` 순서다. 각 물리 파일은 `FileStoragePathPolicy.resolveExisting`로 기준경로 안에서 읽고 실제 size/hash를 계산한다. 직접 소유가 아닌 HTML 참조는 포함하되 warning을 만든다. 동일 파일 ID는 가이드 안에서 한 번만 싣고 역할 우선순위를 적용한다.

- [ ] **Step 5: 선택 export와 목록 모델을 구현한다**

```java
public List<GuideContentCandidate> list(BundleType type);
public BundleArtifact export(BundleType type, List<String> docMngNos);

@Schema(name = "GuideContentMigrationCandidate")
public record GuideContentCandidate(
        String guideKey,
        String docMngNo,
        boolean registered,
        BundleType bundleType,
        String section,
        String fieldLabel,
        LocalDateTime modifiedAt,
        int ownedFileCount) {}
```

FDOC 목록은 catalog 전 항목을 반환하고 활성 문서와 left join한다. 미등록 항목은 `registered=false`, `docMngNo/modifiedAt=null`, 파일 수 0이라 선택할 수 없지만 등록 상태는 화면에 보인다. FDOC `section/fieldLabel`은 catalog에서 채우고, GDOC는 null이며 모든 활성 GDOC는 `registered=true`다. export는 모든 aggregate를 먼저 완성·검증한 후 writer를 호출해 중간 ZIP을 응답하지 않는다. `sourceDocMngNo/sourceFileId`는 manifest 진단 필드에만 둔다.

- [ ] **Step 6: exporter 테스트를 green으로 만든다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*GuideContentAggregateFactoryTest' --tests '*GuideContentExporterTest'
```

Expected: PASS for FDOC/GDOC 범위, BNOTE 제외, selected-only, 공유 파일 가이드별 복제, 누락 참조 실패, deterministic logical IDs와 ZIP entry다.

- [ ] **Step 7: export 계층을 커밋한다**

```powershell
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/document/formguide/FormGuideCatalog.java src/main/java/com/kdb/it/domain/budget/document/repository/GuideDocRepository.java src/main/java/com/kdb/it/infra/file/repository/FileRepository.java src/main/java/com/kdb/it/domain/migration/guidecontent/dto/GuideContentCandidate.java src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentAggregateFactory.java src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentExporter.java src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentAggregateFactoryTest.java src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentExporterTest.java
git diff --cached --stat
git commit -m "feat: 선택 가이드 ZIP 내보내기 추가"
```

### Task 6: dry-run planner와 동일성·덮어쓰기 분류

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/dto/GuideContentMigrationDto.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationPlanner.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationPlannerTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/dto/GuideContentMigrationOpenApiContractTest.java`

**Interfaces:** validated bundle과 삭제 포함 운영 snapshot을 비교해 `ADD/OVERWRITE/RESTORE/UNCHANGED` 및 파일 추가·삭제 수를 만든다. portable HTML을 결정적 검사용 ID로 치환·정화한 결과만 유효하다.

- [ ] **Step 1: 네 action과 위협 모델 테스트를 작성한다**

```java
@Test
void 운영본문이_수정됐으면_보호하지_않고_OVERWRITE로_분류한다() {
    Plan plan = planner.plan(bundle("<p>개발</p>"), target("<p>운영 수정</p>"));
    assertThat(plan.guides()).singleElement()
            .extracting(GuidePlan::action)
            .isEqualTo(Action.OVERWRITE);
}

@Test
void 같은_집합은_UNCHANGED이고_새_파일이_없다() {
    Plan plan = planner.plan(bundleWithPortableIds(), targetWithDifferentDatabaseIds());
    assertThat(plan.guides()).singleElement().satisfies(row -> {
        assertThat(row.action()).isEqualTo(Action.UNCHANGED);
        assertThat(row.filesAdded()).isZero();
        assertThat(row.filesDeleted()).isZero();
    });
}
```

활성 2건, 활성 없음+삭제 2건, FDOC catalog mismatch, endpoint bundleType mismatch, guideKey/title mismatch, 정화 후 참조 손실, unknown `migfile://`, unreferenced manifest file warning을 포함한다.

- [ ] **Step 2: planner 테스트가 red인지 확인한다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*GuideContentMigrationPlannerTest' --tests '*GuideContentMigrationOpenApiContractTest'
```

Expected: FAIL because DTO/planner are absent.

- [ ] **Step 3: API DTO 계약을 구현한다**

```java
public final class GuideContentMigrationDto {
    public enum Action { ADD, OVERWRITE, RESTORE, UNCHANGED }
    @Schema(name = "GuideContentMigrationExportRequest")
    public record ExportRequest(
            @NotEmpty @Size(max = 500) List<@NotBlank String> docMngNos) {}
    @Schema(name = "GuideContentMigrationGuidePlan")
    public record GuidePlan(
            String guideKey, Action action, int filesAdded, int filesDeleted) {}
    @Schema(name = "GuideContentMigrationResponse")
    public record Response(
            boolean committed,
            BundleType bundleType,
            String bundleSha256,
            List<GuidePlan> guides,
            List<String> warnings,
            List<String> errors) {}
}
```

OpenAPI contract test는 모든 record property required 여부, enum 네 값, candidate의 `docMngNo/section/fieldLabel/modifiedAt`만 nullable인 계약을 명시적으로 검사한다.

- [ ] **Step 4: import 정화와 target 비교 planner를 구현한다**

```java
public Plan plan(ValidatedBundle bundle, BundleType expectedType) {
    List<SanitizedPortableAggregate> imports = sanitizeWithDeterministicIds(bundle);
    TargetSnapshot snapshot = loadTargetsIncludingDeleted(imports);
    return classify(imports, snapshot);
}
```

검사용 ID는 logicalFileId 정렬 순번으로 `FL-MIG-00000001`부터 만든다. `portable → test ID → HtmlSanitizer → test ID → portable` 왕복 뒤 참조 집합과 aggregate SHA가 manifest와 같아야 한다. target은 `GuideContentAggregateFactory`로 같은 canonical 형식에 놓는다. target 파일이 이미 깨져 canonicalize할 수 없으면 source commit을 막지 않고 OVERWRITE와 경고로 분류한다.

분류 규칙:

| 상태 | action | filesAdded | filesDeleted |
| --- | --- | ---: | ---: |
| 활성 없음, 삭제 없음 | ADD | ZIP 파일 수 | 0 |
| 활성 1, hash 다름 | OVERWRITE | ZIP 파일 수 | 활성 owned 파일 수 |
| 활성 1, hash 같음 | UNCHANGED | 0 | 0 |
| 활성 없음, 삭제 1 | RESTORE | ZIP 파일 수 | 해당 행의 활성 owned 파일 수 |

OVERWRITE에는 고정 경고 “운영에서 직접 수정한 본문과 가이드 소유 첨부파일이 개발본으로 교체됩니다.”를 추가한다. ZIP에 없는 target은 snapshot 조회와 쓰기 대상에서 제외한다.

- [ ] **Step 5: planner와 OpenAPI 계약 테스트를 green으로 만든다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*GuideContentMigrationPlannerTest' --tests '*GuideContentMigrationOpenApiContractTest'
```

Expected: PASS for 네 action, 운영 수정 덮어쓰기, target-only 유지, sanitizer 순서, duplicate 차단, unchanged no-write plan이다.

- [ ] **Step 6: planner를 커밋한다**

```powershell
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/migration/guidecontent/dto/GuideContentMigrationDto.java src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationPlanner.java src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationPlannerTest.java src/test/java/com/kdb/it/domain/migration/guidecontent/dto/GuideContentMigrationOpenApiContractTest.java
git diff --cached --stat
git commit -m "feat: 가이드 이관 dry-run 계획 추가"
```

### Task 7: 원자적 commit과 중단 파일 정리

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/repository/GuideDocRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/repository/FileRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationService.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentOrphanCleanup.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationServiceTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentOrphanCleanupTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationIt.java`

**Interfaces:** `dryRun(file,type)`은 reader/planner만 호출한다. `commit(file,type)`은 다시 검증·계획하고 real ID 치환·파일 생성·단일 DB 트랜잭션을 수행한다. 프로세스 중단으로 남은 24시간 초과 미참조 이관 파일만 시작/정기 정리한다.

- [ ] **Step 1: 원자성과 보상 삭제 테스트를 작성한다**

```java
@Test
void DB_commit이_실패하면_이번_요청의_새_물리파일만_삭제한다() {
    doThrow(new DataIntegrityViolationException("forced"))
            .when(transactionOperations).executeWithoutResult(any());
    assertThatThrownBy(() -> service.commit(zip, BUSINESS_GUIDE))
            .isInstanceOf(DataIntegrityViolationException.class);
    assertThat(migrationFiles(basePath)).isEmpty();
    assertThat(preExistingFile).exists();
}

@Test
void UNCHANGED는_시퀀스와_파일쓰기를_호출하지_않는다() {
    service.commit(unchangedZip, BUSINESS_GUIDE);
    verify(fileRepository, never()).getNextSequenceValue();
    verifyNoInteractions(fileWriter);
}
```

통합 테스트는 같은 ZIP 재반입 CFILEM 수 불변, 운영 본문/파일 수정 뒤 복원, 여러 가이드 중 한 건 실패 시 DB/파일 zero effect, 선택하지 않은 가이드 불변을 검증한다.

- [ ] **Step 2: service 테스트가 red인지 확인한다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*GuideContentMigrationServiceTest' --tests '*GuideContentOrphanCleanupTest'
```

Expected: FAIL because service/cleanup are absent.

- [ ] **Step 3: real ID 선채번과 target payload 변환을 구현한다**

```java
private Map<String, String> allocateFileIds(PortableGuideAggregate aggregate) {
    return aggregate.files().stream().collect(Collectors.toMap(
            PortableFile::logicalFileId,
            ignored -> String.format("FL-%08d", fileRepository.getNextSequenceValue()),
            (left, right) -> left,
            LinkedHashMap::new));
}
```

ADD 문서는 `SQ_TPRMPP_BGDOCM_1`로 `FDOC-{year}-{seq:04d}` 또는 `GDOC-{year}-{seq:04d}`를 만들고 source doc ID는 쓰지 않는다. 모든 file ID를 먼저 할당한 뒤 HTML과 scene을 변환한다. HTML은 real ID 치환 후 sanitize/reparse/ref-set 검증, scene은 real ID 치환 후 LZ-String Base64 UTF-8 바이트로 압축한다. 어떤 위치에도 `migfile://`가 남으면 파일 쓰기 전에 실패한다.

- [ ] **Step 4: 새 파일 쓰기와 단일 DB 트랜잭션을 구현한다**

```java
public Response commit(MultipartFile file, BundleType type) {
    try (ValidatedBundle bundle = bundleReader.read(file, type)) {
        Plan plan = planner.plan(bundle, type);
        plan.requireCommittable();
        List<PreparedFile> created = writeNewPhysicalFiles(plan, bundle, UUID.randomUUID());
        try {
            transactionTemplate.executeWithoutResult(status -> applyDatabase(plan, created));
        } catch (RuntimeException | Error failure) {
            compensation.deleteCreated(created);
            throw failure;
        }
        return plan.toCommittedResponse();
    }
}
```

`writeNewPhysicalFiles`는 `FileStoragePathPolicy.newMigrationTarget`과 `CREATE_NEW`를 사용한다. DB callback은 다음 순서를 한 트랜잭션에서 수행한다.

1. 현재 target을 다시 조회해 plan 전제와 논리 키 후보 수를 재확인한다.
2. 기존/부활 BGDOCM에 `update(title, sanitizedHtml)` 후 `restore()`, 또는 새 `Bgdocm.builder()`를 persist한다.
3. `APG_FL_KD_NM='가이드문서' AND APG_FL_LNK_CTZ_NM=targetDocMngNo AND DEL_YN='N'` 파일만 `delete()`한다.
4. 새 `Cfilem`은 kind `가이드문서`, parent target doc ID, manifest originalName/fileType, 실제 바이트 크기, 새 physical name/path, `APG_FL_PTH=null`로 save한다.
5. JPA flush로 유일성/컬럼 오류를 commit 전에 표면화한다.

이전 HTML이 다른 kind/parent 파일을 참조해도 삭제하지 않고 warning만 남긴다. 기존 물리 파일도 삭제하지 않는다.

- [ ] **Step 5: 제한된 orphan cleanup을 구현한다**

```java
@EventListener(ApplicationReadyEvent.class)
public void cleanupOnStartup() {
    cleanup();
}

@Scheduled(fixedDelayString = "${app.migration.guide-content.cleanup-fixed-delay-ms:21600000}")
public void cleanup() {
    Instant cutoff = clock.instant().minus(Duration.ofHours(24));
    scanGuideDirectories(cutoff).filter(policy::isMigrationFile)
            .filter(path -> !fileRepository.existsByFlKpnPthAndFlPysNm(
                    path.getParent().toString(), path.getFileName().toString()))
            .forEach(this::deleteInsideBase);
}
```

정리 대상은 base path 아래 `가이드문서` 디렉터리, 정확한 migration filename regex, 24시간 초과, 활성/삭제 여부와 무관하게 CFILEM 미참조인 파일의 교집합이다. symlink를 따라가지 않고 정리 건수만 로그로 남긴다.

- [ ] **Step 6: unit과 Oracle integration을 green으로 만든다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*GuideContentMigrationServiceTest' --tests '*GuideContentOrphanCleanupTest'
./gradlew integrationTest --tests '*GuideContentMigrationIt'
```

Expected: unit PASS. 로컬 Oracle 사용 가능 시 integration PASS for add/overwrite/restore/unchanged, same ZIP no new CFILEM, DB rollback compensation, target-only preservation.

- [ ] **Step 7: commit/cleanup 계층을 커밋한다**

```powershell
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/document/repository/GuideDocRepository.java src/main/java/com/kdb/it/infra/file/repository/FileRepository.java src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationService.java src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentOrphanCleanup.java src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationServiceTest.java src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentOrphanCleanupTest.java src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationIt.java
git diff --cached --stat
git commit -m "feat: 가이드 콘텐츠 원자적 반영 추가"
```

### Task 8: 관리자 API와 비민감 감사 로그

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationAuditLogger.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent/controller/GuideContentMigrationController.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationAuditLoggerTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/controller/GuideContentMigrationControllerTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/migration/guidecontent/dto/GuideContentMigrationOpenApiContractTest.java`

**Interfaces:** 명세의 목록 2개, export 2개, dry-run 2개, commit 2개 엔드포인트를 관리자 전용으로 연다. export는 temp artifact를 response streaming 완료 후 닫는다.

- [ ] **Step 1: 8개 route와 권한·multipart 계약 테스트를 작성한다**

```java
@Test
void 사업가이드_commit은_같은_ZIP을_multipart로_받고_201을_반환한다() throws Exception {
    mockMvc.perform(multipart("/api/admin/migration/guide-content/business-guides/commit")
                    .file(zipPart)
                    .with(adminUser()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.committed").value(true));
}

@Test
void 비관리자는_export도_403이다() throws Exception {
    mockMvc.perform(post("/api/admin/migration/guide-content/business-guides/export")
                    .with(generalUser())
                    .contentType(APPLICATION_JSON)
                    .content("{\"docMngNos\":[\"GDOC-2026-0001\"]}"))
            .andExpect(status().isForbidden());
}
```

빈 export 선택 400, 잘못된 bundle type dry-run 400, zip content type/disposition, form/business 경로가 정확한 service enum을 넘기는지도 검증한다.

- [ ] **Step 2: controller/audit 테스트가 red인지 확인한다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*GuideContentMigrationControllerTest' --tests '*GuideContentMigrationAuditLoggerTest' --tests '*GuideContentMigrationOpenApiContractTest'
```

Expected: FAIL because controller/audit logger are absent.

- [ ] **Step 3: 관리자 API를 구현한다**

```java
@RestController
@RequestMapping("/api/admin/migration/guide-content")
@PreAuthorize("hasRole('ADMIN')")
public class GuideContentMigrationController {
    @GetMapping("/form-guides")
    public List<GuideContentCandidate> formGuides();

    @GetMapping("/business-guides")
    public List<GuideContentCandidate> businessGuides();

    @PostMapping("/form-guides/export")
    public ResponseEntity<StreamingResponseBody> exportFormGuides(
            @Valid @RequestBody ExportRequest request);

    @PostMapping("/business-guides/export")
    public ResponseEntity<StreamingResponseBody> exportBusinessGuides(
            @Valid @RequestBody ExportRequest request);

    @PostMapping(path = "/form-guides/dry-run", consumes = MULTIPART_FORM_DATA_VALUE)
    public Response dryRunFormGuides(@RequestPart("file") MultipartFile file);

    @PostMapping(path = "/form-guides/commit", consumes = MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Response> commitFormGuides(@RequestPart("file") MultipartFile file);
}
```

business dry-run/commit은 같은 형태로 `BUSINESS_GUIDE`를 넘긴다. streaming lambda는 `Files.copy(artifact.path(), outputStream)`을 수행하고 finally에서 artifact를 close한다. 파일명은 고정된 `form-guide-content-v1.zip`/`business-guide-content-v1.zip`이다.

- [ ] **Step 4: 비민감 관리자 감사 로그를 구현한다**

```java
public void log(
        Operation operation,
        String bundleSha256,
        BundleType bundleType,
        int guideCount,
        int fileCount,
        long totalBytes,
        boolean success) {
    log.warn(
            "[가이드이관감사] operation={} actor={} bundleSha256={} bundleType={} guides={} files={} bytes={} success={}",
            operation, sanitize(actor()), bundleSha256, bundleType,
            guideCount, fileCount, totalBytes, success);
}
```

export/dry-run/commit 성공·실패를 모두 기록한다. 업로드 실패도 raw bundle hash를 계산할 수 있으면 기록하고, 읽기 전 실패는 `UNAVAILABLE`을 쓴다. 테스트는 제목/HTML/원본 파일명이 캡처된 로그에 없음을 검증한다.

- [ ] **Step 5: controller/OpenAPI/audit 테스트를 green으로 만든다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*GuideContentMigrationControllerTest' --tests '*GuideContentMigrationAuditLoggerTest' --tests '*GuideContentMigrationOpenApiContractTest'
```

Expected: 8 endpoints, admin 2xx, non-admin 403, empty selection 400, correct response status/schema, sensitive log exclusion PASS.

- [ ] **Step 6: API 계층을 커밋한다**

```powershell
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationAuditLogger.java src/main/java/com/kdb/it/domain/migration/guidecontent/controller/GuideContentMigrationController.java src/test/java/com/kdb/it/domain/migration/guidecontent/GuideContentMigrationAuditLoggerTest.java src/test/java/com/kdb/it/domain/migration/guidecontent/controller/GuideContentMigrationControllerTest.java src/test/java/com/kdb/it/domain/migration/guidecontent/dto/GuideContentMigrationOpenApiContractTest.java
git diff --cached --stat
git commit -m "feat: 가이드 콘텐츠 이관 관리자 API 추가"
```

### Task 9: 독립 ZIP 상태 머신과 도메인별 frontend composable

**Files:**
- Create: `it_frontend/app/utils/guideContentMigration.ts`
- Create: `it_frontend/app/composables/migration/useGuideContentMigrationState.ts`
- Create: `it_frontend/app/composables/migration/useFormGuideMigration.ts`
- Create: `it_frontend/app/composables/migration/useBusinessGuideMigration.ts`
- Modify (generated): `it_frontend/app/types/api.d.ts`
- Create: `it_frontend/tests/unit/utils/guideContentMigration.test.ts`
- Create: `it_frontend/tests/unit/composables/migration/useGuideContentMigrationState.test.ts`
- Create: `it_frontend/tests/unit/composables/migration/useFormGuideMigration.test.ts`
- Create: `it_frontend/tests/unit/composables/migration/useBusinessGuideMigration.test.ts`

**Interfaces:** 두 도메인 composable은 목록/export endpoint만 다르고 ZIP select/dry-run/commit 상태 머신을 각각 새 인스턴스로 가진다. dry-run과 commit은 동일한 `File` 객체를 FormData에 넣는다.

- [ ] **Step 1: 상태 격리·동일 File·danger 판정 테스트를 작성한다**

```ts
it('dry-run과 commit에 같은 File 객체를 넣는다', async () => {
    const file = new File(['zip'], 'business.zip', { type: 'application/zip' });
    await state.selectFile(file);
    await state.commit();
    expect(formDataFile(apiFetch.mock.calls[0])).toBe(file);
    expect(formDataFile(apiFetch.mock.calls[1])).toBe(file);
});

it('사업 가이드 실패가 입력 길라잡이 상태를 초기화하지 않는다', async () => {
    await form.selectFile(formZip);
    await business.selectFile(brokenZip);
    expect(form.result.value).not.toBeNull();
    expect(business.errorMessage.value).not.toBe('');
});
```

`OVERWRITE` 또는 `filesDeleted > 0`이면 `requiresOverwriteConfirmation` true, errors가 있으면 canCommit false, 성공 뒤 해당 인스턴스만 reset되는지 검증한다.

- [ ] **Step 2: frontend state 테스트가 red인지 확인한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- guideContentMigration useGuideContentMigrationState useFormGuideMigration useBusinessGuideMigration
```

Expected: FAIL because utilities/composables/generated contracts are absent.

- [ ] **Step 3: OpenAPI 타입을 생성하고 순수 utility를 구현한다**

Run:

```powershell
cd C:\it\it_frontend
npm run codegen
```

`guideContentMigration.ts`는 생성 타입 alias와 순수 함수를 제공한다.

```ts
export type GuideCandidate = components['schemas']['GuideContentMigrationCandidate'];
export type GuideMigrationResponse = components['schemas']['GuideContentMigrationResponse'];

export const needsOverwriteConfirmation = (response: GuideMigrationResponse): boolean =>
    response.guides.some((guide) => guide.action === 'OVERWRITE' || guide.filesDeleted > 0);
```

- [ ] **Step 4: 공통 상태 머신과 두 domain wrapper를 구현한다**

```ts
export function useGuideContentMigrationState(options: {
    dryRunUrl: string;
    commitUrl: string;
}) {
    const selectedFile = shallowRef<File | null>(null);
    const result = ref<GuideMigrationResponse | null>(null);
    const errorMessage = ref('');
    const isDryRunning = ref(false);
    const isCommitting = ref(false);

    async function selectFile(file: File): Promise<void> {
        selectedFile.value = file;
        result.value = await upload(file, options.dryRunUrl);
    }

    async function commit(): Promise<GuideMigrationResponse> {
        if (!selectedFile.value || !canCommit.value) throw new Error('확정할 ZIP이 없습니다.');
        return await upload(selectedFile.value, options.commitUrl);
    }

    return { selectedFile, result, errorMessage, isDryRunning, isCommitting, selectFile, commit, reset };
}
```

각 upload는 새 `FormData`를 만들되 `selectedFile.value` 객체 자체를 그대로 append한다. domain wrapper는 `candidates`, `selectedDocMngNos`, `isLoadingList`, `isExporting`, `loadCandidates`, `toggleAll`, `exportSelected`를 소유하고 고정 URL을 주입한다. export는 `$apiFetch<Blob>(exportUrl, { method: 'POST', body: { docMngNos }, responseType: 'blob' })` 뒤 `saveAttachmentBlob`을 재사용한다. `registered=false` candidate는 checkbox를 비활성화하고 전체 선택 집합에서도 제외한다.

- [ ] **Step 5: composable 테스트를 green으로 만든다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- guideContentMigration useGuideContentMigrationState useFormGuideMigration useBusinessGuideMigration
npm run codegen:check
```

Expected: selected IDs 정확 전달, 동일 File, 독립 state, danger 판정, 오류 시 commit 비활성, 성공 시 해당 state reset PASS.

- [ ] **Step 6: frontend 상태 계층을 커밋한다**

```powershell
cd C:\it\it_frontend
git add app/types/api.d.ts app/utils/guideContentMigration.ts app/composables/migration/useGuideContentMigrationState.ts app/composables/migration/useFormGuideMigration.ts app/composables/migration/useBusinessGuideMigration.ts tests/unit/utils/guideContentMigration.test.ts tests/unit/composables/migration/useGuideContentMigrationState.test.ts tests/unit/composables/migration/useFormGuideMigration.test.ts tests/unit/composables/migration/useBusinessGuideMigration.test.ts
git diff --cached --stat
git commit -m "feat: 가이드 ZIP 이관 상태 관리 추가"
```

### Task 10: 공통 데이터 화면의 세 독립 이관 영역

**Files:**
- Create: `it_frontend/app/components/migration/CommonDataMigrationSection.vue`
- Create: `it_frontend/app/components/migration/GuideContentMigrationSection.vue`
- Modify: `it_frontend/app/pages/admin/migration/common-data.vue`
- Modify: `it_frontend/i18n/messages/migration.ts`
- Create: `it_frontend/tests/unit/components/migration/CommonDataMigrationSection.test.ts`
- Create: `it_frontend/tests/unit/components/migration/GuideContentMigrationSection.test.ts`
- Create: `it_frontend/tests/unit/pages/commonDataMigrationPageBoundary.test.ts`
- Create: `it_frontend/tests/e2e/guide-content-migration.spec.ts`

**Interfaces:** 한 페이지에 기존 xlsx, FDOC ZIP, GDOC ZIP 세 section을 렌더한다. 각 section은 자체 선택·파일·dry-run·commit UI를 가지며 사업 가이드 위험 확인 전에는 commit을 호출하지 않는다.

- [ ] **Step 1: 화면 경계와 위험 확인 테스트를 작성한다**

```ts
it('세 이관 영역을 동시에 렌더한다', () => {
    const wrapper = mountPage();
    expect(wrapper.find('[data-testid="common-data-section"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="form-guide-migration-section"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="business-guide-migration-section"]').exists()).toBe(true);
});

it('덮어쓰기 확인을 취소하면 commit하지 않는다', async () => {
    const wrapper = mountBusinessSection({ action: 'OVERWRITE', filesDeleted: 2 });
    await wrapper.get('[data-testid="guide-migration-commit"]').trigger('click');
    confirmOptions.reject();
    expect(commit).not.toHaveBeenCalled();
});
```

확인 수락 시 1회 commit, `UNCHANGED`만 있으면 확인 없이 commit, dry-run error 시 disabled, 성공 뒤 해당 목록만 reload되는지 검증한다.

- [ ] **Step 2: UI 테스트가 red인지 확인한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- CommonDataMigrationSection GuideContentMigrationSection commonDataMigrationPageBoundary
```

Expected: FAIL because section components are absent.

- [ ] **Step 3: 기존 xlsx UI를 동작 변경 없이 section으로 이동한다**

`CommonDataMigrationSection.vue`는 현재 page의 guide card, xlsx download/upload, target 표, summary, commit 버튼을 옮기고 내부에서 기존 `useCommonDataMigrationPage()`를 그대로 호출한다. API 경로, workbook 파싱, test id와 `COMMON_DATA_SHEETS/TABLES` 계약은 바꾸지 않는다.

- [ ] **Step 4: 재사용 가능한 guide ZIP section을 구현한다**

Props와 emits:

```ts
const props = defineProps<{
    kind: 'form' | 'business';
    title: string;
    candidates: GuideCandidate[];
    selectedIds: Set<string>;
    state: ReturnType<typeof useGuideContentMigrationState>;
    isLoadingList: boolean;
    isExporting: boolean;
}>();

const emit = defineEmits<{
    export: [];
    toggle: [docMngNo: string];
    toggleAll: [];
    committed: [];
}>();
```

section은 전체/개별 checkbox, 수정일, owned 파일 수, 선택 export, `.zip` dropzone, per-guide action/filesAdded/filesDeleted 표, warnings/errors를 표시한다. OVERWRITE 또는 삭제가 있으면 PrimeVue `useConfirm`으로 다음 고정 문구를 승인받는다.

> 운영에서 직접 수정한 내용과 첨부파일이 개발본으로 교체됩니다.

취소는 상태를 유지하고 commit을 호출하지 않는다. 성공은 자기 state만 reset하고 `committed`를 emit해 자기 목록만 재조회한다.

- [ ] **Step 5: page를 세 독립 영역으로 조립하고 한·영 문구를 추가한다**

```vue
<CommonDataMigrationSection data-testid="common-data-section" />
<GuideContentMigrationSection
    kind="form"
    data-testid="form-guide-migration-section"
    v-bind="formGuideBindings"
/>
<GuideContentMigrationSection
    kind="business"
    data-testid="business-guide-migration-section"
    v-bind="businessGuideBindings"
/>
```

page는 두 domain composable을 각각 한 번 호출한다. 한 영역의 file change/error/reset callback이 다른 composable을 참조하지 않게 한다. `migration.ts`에 candidate loading/error/empty, select all, export, dry-run, actions, files added/deleted, overwrite confirm, commit success/failure의 ko/en 키를 함께 추가한다.

- [ ] **Step 6: UI unit과 mock E2E를 green으로 만든다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- CommonDataMigrationSection GuideContentMigrationSection commonDataMigrationPageBoundary
npx playwright test tests/e2e/guide-content-migration.spec.ts
```

Expected: 기존 xlsx flow, 사업 가이드 단독 selected export/import, 영역 격리, confirm cancel/accept, 같은 File 재업로드, 성공 후 해당 목록 재조회 PASS.

- [ ] **Step 7: 화면 변경을 커밋한다**

```powershell
cd C:\it\it_frontend
git add app/components/migration/CommonDataMigrationSection.vue app/components/migration/GuideContentMigrationSection.vue app/pages/admin/migration/common-data.vue i18n/messages/migration.ts tests/unit/components/migration/CommonDataMigrationSection.test.ts tests/unit/components/migration/GuideContentMigrationSection.test.ts tests/unit/pages/commonDataMigrationPageBoundary.test.ts tests/e2e/guide-content-migration.spec.ts
git diff --cached --stat
git commit -m "feat: 공통 데이터 화면에 가이드 이관 추가"
```

### Task 11: 교차 저장소 회귀 검증과 호환 버전 고정

**Files:**
- Modify: `versions.lock`
- Modify only if implementation facts changed: `docs/superpowers/specs/2026-09-01-guide-content-migration-design.md`

**Interfaces:** 세 저장소의 커밋 조합과 전체 품질 게이트를 고정하고, 계획의 완료 기준을 실제 export/import로 검증한다.

- [ ] **Step 1: 명세 항목과 구현을 1:1 자체 검토한다**

다음 누락 검색을 수행한다.

```powershell
cd C:\it
rg -n "TO[D]O|FIX[M]E|T[B]D|UnsupportedOperationException" it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent it_frontend/app/components/migration it_frontend/app/composables/migration
rg -n "sourceDocMngNo|sourceFileId|flKpnPth|flPysNm|guid|fstEnr|lstChg" it_backend/src/main/java/com/kdb/it/domain/migration/guidecontent
rg -n "useCommonDataMigrationPage" it_frontend/app/composables/migration/useFormGuideMigration.ts it_frontend/app/composables/migration/useBusinessGuideMigration.ts
```

Expected: 미완성 marker 없음. source ID는 manifest 진단/검증에서만 등장하고 target builder 값으로 사용되지 않음. guide ZIP composable은 xlsx composable을 참조하지 않음.

- [ ] **Step 2: 백엔드 전체 게이트를 실행한다**

```powershell
cd C:\it\it_backend
./gradlew test
./gradlew check
./gradlew integrationTest --tests '*GuideContentMigrationIt'
```

Expected: PASS. Oracle이 없는 환경이면 unit/check 결과를 완료하고 integrationTest 미실행 사유를 인계에 명시하되, 운영 반영 전 Oracle 검증은 생략하지 않는다.

- [ ] **Step 3: 프론트엔드 전체 게이트를 실행한다**

```powershell
cd C:\it\it_frontend
npm run format:check
npm run check
npm test
npm run codegen:check
```

Expected: 모두 PASS, generated `api.d.ts` clean.

- [ ] **Step 4: 실제 파일 집합 완료 기준을 검증한다**

개발/운영 대응 환경에서 다음 순서로 확인한다.

1. 일반 첨부, editor 이미지, Excalidraw scene+내부 이미지를 가진 GDOC A와 GDOC B를 준비한다.
2. A만 선택 export하고 운영 dry-run이 A만 `ADD|OVERWRITE|RESTORE`로 표시하는지 확인한다.
3. commit 후 A의 HTML preview/download와 scene 렌더를 확인하고 B DB/CFILEM이 불변인지 확인한다.
4. 같은 ZIP을 다시 dry-run/commit해 `UNCHANGED`, 신규 CFILEM 0건인지 확인한다.
5. 운영 A의 본문과 owned 파일을 직접 수정한 뒤 같은 ZIP을 반영해 개발본으로 되돌아오는지 확인한다.
6. blob을 훼손한 ZIP이 전체 400이고 새 DB 행/물리 파일이 남지 않는지 확인한다.
7. FORM ZIP을 BUSINESS endpoint에 올려 차단되는지 확인한다.

- [ ] **Step 5: 저장소 상태와 민감 로그를 검토한다**

```powershell
cd C:\it\it_backend
git status --short
git log -7 --oneline
cd C:\it\it_frontend
git status --short
git log -3 --oneline
cd C:\it\it_database
git status --short
git log -2 --oneline
```

감사 로그 샘플에 title/body/originalName가 없고 bundle SHA/type/count/bytes/result만 있는지 확인한다. 무관한 기존 변경은 커밋에 포함하지 않는다.

- [ ] **Step 6: 호환 버전을 갱신하고 루트 문서 변경만 커밋한다**

```powershell
cd C:\it
./scripts/update-versions-lock.ps1
git add versions.lock
git diff --cached --stat
git commit -m "chore: 가이드 이관 호환 버전 기록"
```

- [ ] **Step 7: 구현 완료 문서로 이동할 준비를 한다**

모든 게이트와 실제 완료 기준이 통과한 뒤에만 이 계획을 `docs/superpowers/done/`로 이동한다. 미실행 Oracle/E2E 항목이 남으면 plans에 유지하고 정확한 명령과 전제조건을 인계한다.
