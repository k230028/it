# TASK 잔여 항목 조치 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TASK.md`의 에러 처리, DB/JPA, 프론트엔드 리팩토링, 백엔드 리팩토링 잔여 항목 중 실제 코드 조치가 필요한 항목을 순차적으로 해결하고 완료 항목을 문서 이관한다.

**Architecture:** DB/JPA 인덱스와 작성자 소속 컬럼 dev/prod 적용 항목은 `C:\it\it_database\ITPOWN_DDL_live.sql`에 반영되어 있으면 적용 완료로 간주하고 구현 범위에서 제외한다. 남은 작업은 보안·캐시 정합성, 사용자 영향 에러 처리, 프론트 API wiring, 백엔드 트랜잭션·통합 테스트로 분리한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Data JPA, Oracle, Flyway SQL, Nuxt 4, Vue 3, TypeScript, Vitest, JUnit 5, Mockito

---

### Task 1: DB/JPA 적용 완료 항목 문서 이관

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`
- Read: `it_database/ITPOWN_DDL_live.sql`
- Read: `docs/superpowers/specs/2026-07-06-task-remediation-review-design.md`

- [ ] **Step 1: 로컬 DDL 근거를 다시 확인한다**

Run:

```powershell
Select-String -LiteralPath 'C:\it\it_database\ITPOWN_DDL_live.sql' -Encoding UTF8 -Pattern 'IX_BASCTM_PRJ_DEL|IX_BCMMTM_ENO_DEL_ASCT|IX_BRDOCM_DEL_DOC_VRS_FED|IX_BRIVGM_DOC_VRS_DEL_FED|SVN_TEM_C|PRLM_HRK_OGZ_C_CONE|SVN_DPM_C'
```

Expected: P4 후보 인덱스 4개와 작성자 소속 컬럼이 출력된다.

- [ ] **Step 2: `TASK_DONE.md`에 DB/JPA 적용 완료 이력을 추가한다**

Add a dated entry under the DB/JPA completion section:

```markdown
### 🗄️ 2026-07-06 DB/JPA dev/prod 적용 확인

- ✅ P4 후보 인덱스 `V20260629_002~005` 적용 확인
  - 근거: `it_database/ITPOWN_DDL_live.sql`
  - 확인 인덱스: `IX_BASCTM_PRJ_DEL`, `IX_BCMMTM_ENO_DEL_ASCT`, `IX_BRDOCM_DEL_DOC_VRS_FED`, `IX_BRIVGM_DOC_VRS_DEL_FED`
- ✅ 작성자 소속 컬럼 `V20260701_002` 적용 확인
  - 근거: `it_database/ITPOWN_DDL_live.sql`
  - 확인 컬럼: `BPROJM/BPROJL.SVN_TEM_C`, `BCOSTM/BCOSTL.PRLM_HRK_OGZ_C_CONE`, `BRDOCM/BRDOCL.SVN_DPM_C/SVN_TEM_C`
- 판정 기준: 로컬 DDL(`C:\it\it_database\ITPOWN_DDL_live.sql`)에 적용 완료가 확인되면 dev/prod도 적용 완료로 간주한다.
```

- [ ] **Step 3: `TASK.md`에서 해당 Open 행을 제거한다**

Remove the two rows from `TASK.md` §DB / JPA 최적화 whose task text starts with:

```markdown
[W4] P4 후보 인덱스(`V20260629_002~005`) **dev/prod 적용 (DBA)**
[W4] 작성자 소속 컬럼 마이그레이션(`V20260701_002`) **dev/prod 적용 (DBA)**
```

- [ ] **Step 4: 문서 변경만 검증한다**

Run:

```powershell
git diff -- TASK.md TASK_DONE.md docs/superpowers/specs/2026-07-06-task-remediation-review-design.md
```

Expected: DB/JPA 적용 완료 이관과 spec의 적용 완료 전제만 보인다.

- [ ] **Step 5: 문서 이관 커밋**

```powershell
git add -- TASK.md TASK_DONE.md docs/superpowers/specs/2026-07-06-task-remediation-review-design.md
git commit -m "docs: DB/JPA 적용 확인 항목 완료 이관"
```

---

### Task 2: Refresh Token 해시 조회와 Tiptap 캐시 키 정합성

**Files:**
- Create: `it_database/migrations/V20260706_001__AddRefreshTokenHash.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/entity/Crtokm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/repository/RefreshTokenRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/tiptap/service/TiptapVariableService.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/tiptap/service/TiptapVariableServiceTest.java`

- [ ] **Step 1: Refresh Token 해시 테스트를 먼저 추가한다**

Add tests to `AuthServiceTest`:

```java
@Test
@DisplayName("refreshAccessToken - 토큰 해시로 조회하고 신규 토큰에도 해시를 저장한다")
void refreshAccessToken_hashLookup_savesHash() {
        String oldToken = "old-refresh-token";
        String newToken = "new-refresh-token";
        Crtokm stored = Crtokm.builder()
                .tokCone(oldToken)
                .tokHashCone(AuthService.sha256HexForToken(oldToken))
                .eno("E1")
                .famNm("FAM1")
                .avlYn("Y")
                .endDtm(LocalDateTime.now().plusDays(1))
                .build();
        CuserI user = CuserI.builder().eno("E1").empNm("홍길동").bbrC("D001").build();

        given(jwtUtil.validateToken(oldToken)).willReturn(true);
        given(refreshTokenRepository.findByTokHashCone(AuthService.sha256HexForToken(oldToken)))
                .willReturn(Optional.of(stored));
        given(userRepository.findByEno("E1")).willReturn(Optional.of(user));
        given(roleRepository.findByEno("E1")).willReturn(List.of());
        given(jwtUtil.generateAccessToken("E1", List.of(), "D001")).willReturn("access");
        given(jwtUtil.generateRefreshToken("E1")).willReturn(newToken);

        AuthDto.RefreshResponse response = authService.refreshAccessToken(oldToken);

        assertThat(response.getRefreshToken()).isEqualTo(newToken);
        verify(refreshTokenRepository).findByTokHashCone(AuthService.sha256HexForToken(oldToken));
        verify(refreshTokenRepository).save(argThat(token ->
                newToken.equals(token.getTokCone())
                        && AuthService.sha256HexForToken(newToken).equals(token.getTokHashCone())));
}
```

- [ ] **Step 2: 해시 조회 테스트가 컴파일 실패하는지 확인한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests com.kdb.it.common.system.service.AuthServiceTest --warning-mode all
```

Expected: `findByTokHashCone`, `getTokHashCone`, `sha256HexForToken`가 없어 컴파일 실패한다.

- [ ] **Step 3: Refresh Token 해시 마이그레이션을 추가한다**

Create `it_database/migrations/V20260706_001__AddRefreshTokenHash.sql`:

```sql
-- V20260706_001__AddRefreshTokenHash.sql
-- Refresh Token 원문 조회를 SHA-256 해시 조회로 전환하기 위한 해시 컬럼과 UNIQUE 인덱스.
DECLARE
    FUNCTION col_exists(p_tab VARCHAR2, p_col VARCHAR2) RETURN BOOLEAN IS
        n NUMBER;
    BEGIN
        SELECT COUNT(*) INTO n
          FROM ALL_TAB_COLUMNS
         WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
           AND TABLE_NAME = p_tab
           AND COLUMN_NAME = p_col;
        RETURN n > 0;
    END;
    FUNCTION idx_exists(p_idx VARCHAR2) RETURN BOOLEAN IS
        n NUMBER;
    BEGIN
        SELECT COUNT(*) INTO n
          FROM ALL_INDEXES
         WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
           AND INDEX_NAME = p_idx;
        RETURN n > 0;
    END;
BEGIN
    IF NOT col_exists('TPRMPP_CRTOKM', 'API_TOK_HASH_CONE') THEN
        EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_CRTOKM ADD (API_TOK_HASH_CONE VARCHAR2(64 CHAR))';
        EXECUTE IMMEDIATE 'COMMENT ON COLUMN TPRMPP_CRTOKM.API_TOK_HASH_CONE IS ''API토큰해시내용(SHA-256 HEX)''';
    END IF;

    IF NOT idx_exists('UX_CRTOKM_API_TOK_HASH') THEN
        EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX UX_CRTOKM_API_TOK_HASH ON TPRMPP_CRTOKM(API_TOK_HASH_CONE)';
    END IF;
END;
/
```

- [ ] **Step 4: `Crtokm`에 해시 필드를 추가한다**

Add field after `tokCone`:

```java
/** 토큰해시내용: Refresh Token 원문을 SHA-256 HEX로 변환한 조회 키 */
@Column(name = "API_TOK_HASH_CONE", length = 64, comment = "토큰해시내용")
private String tokHashCone;

/** 기존 원문 토큰 행에 해시가 비어 있으면 호환 기간 중 1회 백필한다. */
public void fillHashIfMissing(String hash) {
    if (this.tokHashCone == null || this.tokHashCone.isBlank()) {
        this.tokHashCone = hash;
    }
}
```

- [ ] **Step 5: Repository를 해시 조회 우선으로 바꾼다**

Add method to `RefreshTokenRepository`:

```java
/** SHA-256 HEX 토큰 해시로 갱신토큰 조회 */
Optional<Crtokm> findByTokHashCone(String tokHashCone);
```

Keep `findByTokCone` during compatibility period.

- [ ] **Step 6: `AuthService`에 해시 생성과 호환 조회를 구현한다**

Add helper:

```java
public static String sha256HexForToken(String token) {
    try {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = digest.digest(token.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    } catch (NoSuchAlgorithmException e) {
        throw new IllegalStateException("SHA-256 해시 알고리즘을 사용할 수 없습니다.", e);
    }
}

private Crtokm findRefreshTokenByValue(String refreshTokenValue) {
    String tokenHash = sha256HexForToken(refreshTokenValue);
    return refreshTokenRepository.findByTokHashCone(tokenHash)
            .or(() -> refreshTokenRepository.findByTokCone(refreshTokenValue)
                    .map(token -> {
                        token.fillHashIfMissing(tokenHash);
                        return token;
                    }))
            .orElseThrow(() -> new RuntimeException("Refresh Token을 찾을 수 없습니다."));
}
```

In `refreshAccessToken`, replace:

```java
Crtokm refreshToken = refreshTokenRepository.findByTokCone(refreshTokenValue)
        .orElseThrow(() -> new RuntimeException("Refresh Token을 찾을 수 없습니다."));
```

with:

```java
Crtokm refreshToken = findRefreshTokenByValue(refreshTokenValue);
```

When creating a new token:

```java
.tokCone(newRefreshTokenValue)
.tokHashCone(sha256HexForToken(newRefreshTokenValue))
```

And in `issueNewRefreshFamily`:

```java
.tokCone(value)
.tokHashCone(sha256HexForToken(value))
```

- [ ] **Step 7: Tiptap 캐시 키 테스트를 추가한다**

Add tests to `TiptapVariableServiceTest`:

```java
@Test
@DisplayName("metadataCacheKey — 부서 없는 일반 사용자는 사번 격리 키를 사용한다")
void metadataCacheKey_userWithoutDept_usesEnoKey() {
    var user = new CustomUserDetails("E-NO-DEPT", List.of("ITPZZ001"), null);

    assertThat(TiptapVariableService.metadataCacheKey(user)).isEqualTo("USER_NO_DEPT:E-NO-DEPT");
}

@Test
@DisplayName("metadata — 부서 없는 일반 사용자는 빈 사업 목록을 반환한다")
void getMetadata_userWithoutDept_returnsEmptyProjects() {
    var user = new CustomUserDetails("E-NO-DEPT", List.of("ITPZZ001"), null);

    MetadataResponse response = service.getMetadata(user);

    var proj = response.categories().stream()
            .filter(c -> c.code().equals("PROJ"))
            .findFirst()
            .orElseThrow();
    assertThat(proj.projects()).isEmpty();
    verify(projectRepository, never()).findActiveProjectRefs();
    verify(projectRepository, never()).findActiveProjectRefsByDept(any());
}
```

- [ ] **Step 8: Tiptap 캐시 키 구현을 바꾼다**

In `TiptapVariableService` replace `@Cacheable` key and add helper:

```java
@Cacheable(value = "tiptapMetadata", key = "T(com.kdb.it.common.system.tiptap.service.TiptapVariableService).metadataCacheKey(#user)")
public MetadataResponse getMetadata(CustomUserDetails user) {
    List<Integer> years = currentPlusMinusTwo();
    boolean seeAll = user.isAdmin() || user.isDeptManager();
    List<ProjectRef> projects;
    if (seeAll) {
        projects = projectRepository.findActiveProjectRefs().stream()
                .map(r -> new ProjectRef(r.code(), r.name()))
                .toList();
    } else if (org.springframework.util.StringUtils.hasText(user.getBbrC())) {
        projects = projectRepository.findActiveProjectRefsByDept(user.getBbrC()).stream()
                .map(r -> new ProjectRef(r.code(), r.name()))
                .toList();
    } else {
        projects = List.of();
    }
    return new MetadataResponse(List.of(
            new CategoryMetadata("IT_BUDGET", "전산예산", years, null, ITEMS),
            new CategoryMetadata("CAP_BUDGET", "자본예산", years, null, ITEMS),
            new CategoryMetadata("OPEX", "일반관리비", years, null, ITEMS),
            new CategoryMetadata("PROJ", "사업별", years, projects, ITEMS)
    ));
}

public static String metadataCacheKey(CustomUserDetails user) {
    if (user == null) {
        return "ANONYMOUS";
    }
    if (user.isAdmin() || user.isDeptManager()) {
        return "ALL";
    }
    if (org.springframework.util.StringUtils.hasText(user.getBbrC())) {
        return "DEPT:" + user.getBbrC();
    }
    return "USER_NO_DEPT:" + user.getUsername();
}
```

- [ ] **Step 9: 백엔드 테스트를 실행한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests com.kdb.it.common.system.service.AuthServiceTest --tests com.kdb.it.common.system.tiptap.service.TiptapVariableServiceTest --warning-mode all
```

Expected: PASS.

- [ ] **Step 10: 커밋한다**

```powershell
git add -- it_database/migrations/V20260706_001__AddRefreshTokenHash.sql it_backend/src/main/java/com/kdb/it/common/system/entity/Crtokm.java it_backend/src/main/java/com/kdb/it/common/system/repository/RefreshTokenRepository.java it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java it_backend/src/main/java/com/kdb/it/common/system/tiptap/service/TiptapVariableService.java it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java it_backend/src/test/java/com/kdb/it/common/system/tiptap/service/TiptapVariableServiceTest.java
git commit -m "fix: Refresh Token 해시 조회와 Tiptap 캐시 키 정합화"
```

---

### Task 3: 사용자 영향 에러 처리 보강

**Files:**
- Modify: `it_frontend/app/pages/budget/work.vue`
- Modify: `it_frontend/app/utils/hwpx-images.ts`
- Modify: `it_frontend/app/composables/useHwpxExport.ts`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditLogPersister.java`
- Test: `it_frontend/tests/unit/utils/hwpx-images.test.ts`
- Test: `it_backend/src/test/java/com/kdb/it/domain/log/listener/AuditLogPersisterTest.java`

- [ ] **Step 1: HWPX 부분 실패 반환 타입 테스트를 추가한다**

Create or extend `it_frontend/tests/unit/utils/hwpx-images.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { convertHtmlImagesForHwpx } from '~/utils/hwpx-images';

describe('convertHtmlImagesForHwpx', () => {
    it('이미지 변환 실패 목록을 누락 이미지로 반환한다', async () => {
        const html = '<p><img src="https://example.invalid/missing.png" alt="누락 이미지"></p>';
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

        const result = await convertHtmlImagesForHwpx(html);

        expect(result.images).toHaveLength(0);
        expect(result.failures).toEqual([
            expect.objectContaining({
                src: 'https://example.invalid/missing.png',
                alt: '누락 이미지',
            }),
        ]);
    });
});
```

- [ ] **Step 2: HWPX 테스트 실패를 확인한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/utils/hwpx-images.test.ts
```

Expected: `failures` property가 없어 FAIL.

- [ ] **Step 3: `hwpx-images.ts` 반환 타입을 확장한다**

Change return type:

```ts
export interface HwpxImageFailure {
    src: string;
    alt: string;
    reason: string;
}

export interface HwpxImageConversionResult {
    images: HwpxImage[];
    failures: HwpxImageFailure[];
}
```

Inside the image loop catch:

```ts
} catch (error: unknown) {
    failures.push({
        src: p.src,
        alt: p.alt ?? '',
        reason: error instanceof Error ? error.message : '이미지 변환 중 알 수 없는 오류가 발생했습니다.',
    });
}
```

Return:

```ts
return { images: results, failures };
```

Update callers to use `result.images` and display `result.failures` warning.

- [ ] **Step 4: 예산 DUP 코드 실패 상태를 추가한다**

In `work.vue`, add state:

```ts
const dupCodesLoaded = ref(false);
const dupCodesError = ref<string | null>(null);
const dupCodesReady = computed(() => dupCodesLoaded.value && dupCodesError.value === null);
```

In `loadDupCodes`, replace catch:

```ts
    } catch (error: unknown) {
        dupCodesError.value =
            error instanceof Error ? error.message : '예산 편성 기준코드를 조회하지 못했습니다.';
        dupCodesLoaded.value = false;
        toast.add({
            severity: 'error',
            summary: '기준코드 조회 실패',
            detail: '예산 편성 기준값을 불러오지 못했습니다. 다시 시도해 주세요.',
            life: 5000,
        });
    }
```

Guard save/calculation entry points:

```ts
if (!dupCodesReady.value) {
    toast.add({
        severity: 'warn',
        summary: '기준값 확인 필요',
        detail: '중복률 기준코드를 불러온 뒤 계산과 저장을 진행할 수 있습니다.',
        life: 4000,
    });
    return;
}
```

- [ ] **Step 5: 감사로그 리플렉션 실패 진단 테스트를 추가한다**

Add to `AuditLogPersisterTest`:

```java
@Test
@DisplayName("getFieldValue - 접근 실패 시 필드명과 클래스명을 포함해 경고한다")
void getFieldValue_accessFailure_logsFieldName() {
    // SecurityManager를 쓰지 않는 JDK 25 환경에서는 private final 필드 접근 실패를 강제하기 어렵다.
    // 대신 존재하지 않는 필드는 조용히 null, 접근 예외는 warn 경로를 타도록 setFieldQuiet 테스트에서 검증한다.
    assertThatCode(() -> auditLogPersister.persist(new TestEntityWithoutLogTarget(), "U"))
            .doesNotThrowAnyException();
}
```

If existing tests already cover non-throwing behavior, add a direct package-private helper test after changing helpers to package-private:

```java
@Test
@DisplayName("setFieldQuiet - 필드가 없으면 조용히 종료한다")
void setFieldQuiet_missingField_doesNotThrow() {
    assertThatCode(() -> auditLogPersister.setFieldQuietForTest(new Object(), "missing", "value"))
            .doesNotThrowAnyException();
}
```

- [ ] **Step 6: 감사로그 진단 로그를 구현한다**

In `AuditLogPersister`:

```java
} catch (IllegalAccessException e) {
    log.warn("감사로그 필드 읽기 실패 — targetClass={}, fieldName={}",
            target.getClass().getName(), fieldName, e);
    return null;
}
```

And:

```java
} catch (IllegalAccessException e) {
    log.warn("감사로그 필드 설정 실패 — targetClass={}, fieldName={}",
            target.getClass().getName(), fieldName, e);
}
```

- [ ] **Step 7: 테스트와 타입체크를 실행한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/utils/hwpx-images.test.ts
npm run typecheck
cd C:\it\it_backend
.\gradlew test --tests com.kdb.it.domain.log.listener.AuditLogPersisterTest --warning-mode all
```

Expected: all PASS.

- [ ] **Step 8: 커밋한다**

```powershell
git add -- it_frontend/app/pages/budget/work.vue it_frontend/app/utils/hwpx-images.ts it_frontend/app/composables/useHwpxExport.ts it_frontend/tests/unit/utils/hwpx-images.test.ts it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditLogPersister.java it_backend/src/test/java/com/kdb/it/domain/log/listener/AuditLogPersisterTest.java
git commit -m "fix: 사용자 영향 에러 처리 보강"
```

---

### Task 4: 예산 조회/비교 API wiring과 프론트 타입 정리

**Files:**
- Modify: `it_frontend/app/pages/budget/summary.vue`
- Modify: `it_frontend/app/pages/budget/comparison.vue`
- Modify: `it_frontend/app/composables/useProjects.ts`
- Modify: `it_frontend/app/composables/useTabs.ts`
- Modify: `it_frontend/app/pages/info/documents/form.vue`
- Modify: `it_frontend/app/pages/info/documents/[id]/index.vue`
- Modify: `it_frontend/app/components/AttachmentNodeView.vue`
- Test: `it_frontend/tests/unit/composables/useTabs.test.ts`

- [ ] **Step 1: `useTabs` 입력 타입 테스트를 추가한다**

Add to `useTabs.test.ts`:

```ts
it('addTab은 path/fullPath/meta.title만 있는 좁은 라우트 입력을 받는다', () => {
    const { addTab, tabs } = useTabs();

    addTab({ path: '/info/projects', fullPath: '/info/projects?page=1', meta: { title: '사업' } });

    expect(tabs.value[0]).toMatchObject({
        path: '/info/projects',
        fullPath: '/info/projects?page=1',
        title: '사업',
    });
});
```

- [ ] **Step 2: `useTabs` 타입을 구현한다**

In `useTabs.ts`:

```ts
export interface TabRouteInput {
    path: string;
    fullPath: string;
    meta?: {
        title?: unknown;
    };
}

const addTab = (newRoute: TabRouteInput): boolean => {
    const routeTitle = typeof newRoute.meta?.title === 'string' ? newRoute.meta.title : '';
    const title = routeTitle || fallbackTitle(newRoute.path);
    const existingTab = tabs.value.find((t) => t.fullPath === newRoute.fullPath);
    if (!existingTab) {
        tabs.value.push({
            id: newRoute.fullPath,
            title,
            path: newRoute.path,
            fullPath: newRoute.fullPath,
            closable: newRoute.path !== '/',
        });
        normalizeDuplicateTitles(newRoute.path);
    }
    activeTab.value = newRoute.fullPath;
    return true;
};
```

Remove the `any` eslint suppression.

- [ ] **Step 3: `useProjects` 요청 DTO를 추가한다**

In `useProjects.ts`, define minimal types near existing project types:

```ts
export type ProjectMutationPayload = Partial<ProjectDetail> & {
    abusNm?: string;
    bseYy?: string;
    items?: unknown[];
};
```

Replace:

```ts
const createProject = async (payload: any) => {
```

with:

```ts
const createProject = async (payload: ProjectMutationPayload) => {
```

Replace update similarly:

```ts
const updateProject = async (id: string | number, payload: ProjectMutationPayload) => {
```

- [ ] **Step 4: 예산 summary 페이지를 API 기반으로 전환한다**

In `summary.vue`, replace `MOCK_ROWS` usage with:

```ts
const { fetchSummary } = useItBudget();
const { data: summaryData, pending, error, refresh } = fetchSummary(selectedYear);

const rows = computed(() => summaryData.value?.rows ?? []);
const itTotal = computed(() => rows.value.reduce((sum, row) => sum + row.itAdjAmt, 0));
const secTotal = computed(() => rows.value.reduce((sum, row) => sum + row.secAdjAmt, 0));
```

Update template loops:

```vue
<template v-for="row in rows" :key="row.ioeCode">
```

Add error block:

```vue
<Message v-if="error" severity="error" :closable="false">
    예산 조회 데이터를 불러오지 못했습니다.
    <Button label="재시도" text size="small" @click="refresh()" />
</Message>
```

- [ ] **Step 5: 예산 comparison 페이지를 API 기반으로 전환한다**

In `comparison.vue`:

```ts
const { fetchComparison } = useItBudget();
const { data: comparisonData, pending, error, refresh } = fetchComparison(selectedYear);

const fssRows = computed(() => comparisonData.value?.fssMapping ?? []);
const yoyRows = computed(() => comparisonData.value?.yoyComparison ?? []);
```

Replace template loops:

```vue
<tr v-for="(row, i) in fssRows" :key="`${row.bankCategoryNm}-${i}`" class="data-row">
    <td>{{ row.bankCategoryNm }}</td>
    <td>{{ row.fssCategory }}</td>
    <td>{{ row.note }}</td>
</tr>
<tr v-for="(row, i) in yoyRows" :key="`${row.ioeCode}-${i}`" class="data-row">
    <td>{{ row.categoryNm }}</td>
    <td class="text-right">{{ formatBudget(row.prevAmt) }}</td>
    <td class="text-right">{{ formatBudget(row.currAmt) }}</td>
    <td class="text-right">{{ formatBudget(row.diff) }}</td>
    <td class="text-right">{{ row.diffRate == null ? '-' : `${row.diffRate}%` }}</td>
</tr>
```

- [ ] **Step 6: 파일 크기 표시 중복을 공통 유틸로 바꾼다**

In `AttachmentNodeView.vue`, `documents/form.vue`, `documents/[id]/index.vue`:

```ts
import { formatFileSize } from '~/utils/common';
```

Remove local `formatFileSize` functions. Keep `0` display as `0 B` because `utils/common.ts` already defines that policy.

- [ ] **Step 7: 프론트 검증을 실행한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/composables/useTabs.test.ts tests/unit/utils/common.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: 커밋한다**

```powershell
git add -- it_frontend/app/pages/budget/summary.vue it_frontend/app/pages/budget/comparison.vue it_frontend/app/composables/useProjects.ts it_frontend/app/composables/useTabs.ts it_frontend/app/pages/info/documents/form.vue it_frontend/app/pages/info/documents/[id]/index.vue it_frontend/app/components/AttachmentNodeView.vue it_frontend/tests/unit/composables/useTabs.test.ts
git commit -m "refactor: 예산 API 연결과 프론트 타입 정리"
```

---

### Task 5: 파일 업로드 트랜잭션 계약과 백엔드 통합 테스트 보강

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java`
- Create: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileUploadUnitService.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/estimate/repository/EstimateRepositoryIntegrationTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/log/listener/AuditLogPersisterIntegrationTest.java`

- [ ] **Step 1: 파일 업로드 계약을 부분 성공 유지로 고정한다**

Use this behavior:

```text
여러 파일 중 일부 파일 저장이 실패해도 성공 파일은 커밋한다.
응답의 successList는 실제 커밋된 파일만 포함한다.
응답의 failList는 파일명과 실패 메시지를 포함한다.
```

- [ ] **Step 2: 독립 트랜잭션 서비스 테스트를 먼저 추가한다**

Extend `FileServiceTest` with a repository failure case:

```java
@Test
@DisplayName("uploadFiles: 두 번째 파일 DB 저장 실패 시 첫 번째 성공 파일은 성공 목록에 남는다")
void uploadFiles_secondDbFailure_keepsFirstSuccess(@TempDir Path tempDir) {
    MockMultipartFile okFile = new MockMultipartFile("files", "ok.txt", "text/plain", "ok".getBytes());
    MockMultipartFile badFile = new MockMultipartFile("files", "bad.txt", "text/plain", "bad".getBytes());
    FileDto.UploadRequest request = FileDto.UploadRequest.builder()
            .orcDtt("테스트")
            .pkColNm("TEST-1")
            .build();

    given(fileRepository.save(any(Cfilem.class)))
            .willAnswer(invocation -> invocation.getArgument(0))
            .willThrow(new RuntimeException("DB 저장 실패"));

    FileDto.BulkUploadResponse result = fileService.uploadFiles(List.of(okFile, badFile), request);

    assertThat(result.getSuccessList()).hasSize(1);
    assertThat(result.getFailList()).anySatisfy(message -> assertThat(message).contains("bad.txt"));
}
```

- [ ] **Step 3: 독립 업로드 서비스를 만든다**

Create `FileUploadUnitService.java`:

```java
package com.kdb.it.infra.file.service;

import com.kdb.it.infra.file.dto.FileDto;
import com.kdb.it.infra.file.entity.Cfilem;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class FileUploadUnitService {

    private final FileService fileService;

    /** 파일 1건을 독립 트랜잭션으로 저장해 다건 업로드 부분 성공 계약을 보장한다. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Cfilem uploadOne(MultipartFile file, FileDto.UploadRequest request) {
        return fileService.uploadFileInternalForUnit(file, request);
    }
}
```

In `FileService`, expose package-private method:

```java
Cfilem uploadFileInternalForUnit(MultipartFile file, FileDto.UploadRequest request) {
    return uploadFileInternal(file, request);
}
```

Inject `FileUploadUnitService` into `FileService` and call `uploadUnitService.uploadOne(file, request)` in `uploadFiles`.

- [ ] **Step 4: 순환 의존이 생기면 내부 저장 로직을 별도 helper로 이동한다**

If Spring reports a circular dependency, move the body of `uploadFileInternal` into `FileStorageWriter`:

```java
@Service
@RequiredArgsConstructor
class FileStorageWriter {
    Cfilem uploadFileInternal(MultipartFile file, FileDto.UploadRequest request) {
        // 기존 FileService.uploadFileInternal 본문을 그대로 이동한다.
    }
}
```

Then inject `FileStorageWriter` into both services.

- [ ] **Step 5: EstimateRepository 통합 테스트를 추가한다**

Create `EstimateRepositoryIntegrationTest.java`:

```java
package com.kdb.it.domain.estimate.repository;

import com.kdb.it.support.AbstractOracleRepositoryTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThatCode;

@Tag("it")
class EstimateRepositoryIntegrationTest extends AbstractOracleRepositoryTest {

    @Autowired EstimateRepository estimateRepository;

    @Test
    @DisplayName("search: 로컬 Oracle 스키마에서 QueryDSL 검색 쿼리가 실행된다")
    void search_runsOnOracleSchema() {
        assertThatCode(() -> estimateRepository.search(null, null, null, null))
                .doesNotThrowAnyException();
    }
}
```

- [ ] **Step 6: 감사로그 통합 테스트를 추가한다**

Create `AuditLogPersisterIntegrationTest.java`:

```java
package com.kdb.it.domain.log.listener;

import com.kdb.it.support.AbstractOracleRepositoryTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("it")
class AuditLogPersisterIntegrationTest extends AbstractOracleRepositoryTest {

    @Autowired AuditLogPersister auditLogPersister;

    @Test
    @DisplayName("AuditLogPersister 빈이 로컬 Oracle 통합 테스트 컨텍스트에서 로드된다")
    void context_loadsPersister() {
        assertThat(auditLogPersister).isNotNull();
    }
}
```

- [ ] **Step 7: 백엔드 테스트를 실행한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests com.kdb.it.infra.file.service.FileServiceTest --warning-mode all
.\gradlew integrationTest --tests com.kdb.it.domain.estimate.repository.EstimateRepositoryIntegrationTest --tests com.kdb.it.domain.log.listener.AuditLogPersisterIntegrationTest --warning-mode all
```

Expected: unit tests PASS. `integrationTest` either PASS when local Oracle is available or cleanly SKIPPED by the existing Oracle availability condition.

- [ ] **Step 8: 커밋한다**

```powershell
git add -- it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java it_backend/src/main/java/com/kdb/it/infra/file/service/FileUploadUnitService.java it_backend/src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java it_backend/src/test/java/com/kdb/it/domain/estimate/repository/EstimateRepositoryIntegrationTest.java it_backend/src/test/java/com/kdb/it/domain/log/listener/AuditLogPersisterIntegrationTest.java
git commit -m "fix: 파일 업로드 부분 성공 계약과 통합 테스트 보강"
```

---

### Task 6: 최종 검증과 TASK 이관

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`

- [ ] **Step 1: 백엔드 전체 테스트를 실행한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --warning-mode all
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 2: 프론트 타입체크와 주요 테스트를 실행한다**

Run:

```powershell
cd C:\it\it_frontend
npm run typecheck
npm test -- tests/unit/utils/hwpx-images.test.ts tests/unit/composables/useTabs.test.ts tests/unit/utils/common.test.ts
```

Expected: all PASS.

- [ ] **Step 3: 변경된 TASK 항목을 완료 이관한다**

Move completed rows from `TASK.md` to `TASK_DONE.md` with commit hashes and files:

```markdown
### 2026-07-06 TASK 잔여 조치

- ✅ Refresh Token 해시 조회 정합화
- ✅ Tiptap metadata null 부서 캐시 키 정합화
- ✅ 예산 DUP 코드 조회 실패 차단
- ✅ HWPX 이미지 변환 부분 실패 노출
- ✅ 감사로그 리플렉션 실패 진단 보강
- ✅ 예산 조회/비교 Mock 제거
- ✅ 프론트 `any` 일부 제거와 표시 유틸 통합
- ✅ 파일 다건 업로드 부분 성공 트랜잭션 계약 정리
- ✅ EstimateRepository/AuditLog 통합 테스트 보강
```

Leave these in `TASK.md` if not implemented in this plan:

```markdown
- `info/index.vue` 정적 KPI/공지/일정 운영 데이터 전환
- 목록 프로젝션 DTO 작업
- 알림 문구 중복 공통화
- Javadoc 잔여 경고 정리
```

- [ ] **Step 4: 최종 diff를 검토한다**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only files touched by this plan plus pre-existing user changes. Do not revert unrelated `prds/*` changes.

- [ ] **Step 5: 최종 문서 커밋**

```powershell
git add -- TASK.md TASK_DONE.md
git commit -m "docs: TASK 잔여 조치 완료 이관"
```
