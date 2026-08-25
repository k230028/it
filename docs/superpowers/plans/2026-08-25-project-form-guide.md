# Project Form Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `info/projects/form`의 모든 사업 데이터 입력 필드에 유형별 길라잡이를 표시하고 관리자가 고정 카탈로그 안에서 내용을 관리하게 한다.

**Architecture:** `TPRMPP_BGDOCM`은 공유하되 `GDOC-*`와 `FDOC-*` 관리번호로 문서 종류를 격리한다. 백엔드 고정 카탈로그와 전용 공개/관리 API를 만들고, 프론트는 폼 진입 시 scope별 본문을 일괄 조회한 뒤 활성 입력의 ID로 우측 패널을 전환한다.

**Tech Stack:** Oracle/Flyway, Java 25, Spring Boot 4, Spring Data JPA, Spring Security, Nuxt 4 CSR, Vue 3, TypeScript, PrimeVue, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-25-project-form-guide-design.md`

## Global Constraints

- 정보화사업과 경상사업 ID는 각각 `info.*`, `cost.*`로 분리한다.
- 단계별 가이드는 `GDOC-{year}-{seq:04d}`, 입력 길라잡이는 `FDOC-{year}-{seq:04d}`를 사용한다.
- 소요자원 동적 행은 행 번호 없이 열 단위 ID를 공유한다.
- 카탈로그 밖 ID를 저장하지 않으며 길라잡이 쓰기는 `ROLE_ADMIN`만 허용한다.
- 등록 본문이 없으면 사용자 폼에 패널이나 빈 안내를 렌더링하지 않는다.
- 신규 JavaDoc·TSDoc·인라인 주석은 한글로 작성한다.
- API 계약 변경 뒤 백엔드를 기동해 `npm run codegen`으로 `app/types/api.d.ts`를 재생성한다.
- 세 저장소의 무관한 변경을 건드리지 않고 각 커밋은 경로를 명시해 스테이징한다.

---

### Task 1: FDOC 활성 ID 유일성 및 관리자 메뉴 마이그레이션

**Files:**
- Create: `it_database/migrations/V20260825_001__AddFormGuideUniquenessAndAdminMenu.sql`
- Create: `it_database/migrations/_verify/form-guide-and-menu-verify.sql`

**Interfaces:**
- Consumes: `TPRMPP_BGDOCM`, `SQ_TPRMPP_CMENUM_1`, 관리자 부모 메뉴 `MADM0010`, 권한 `ITPAD001`
- Produces: 활성 FDOC 대상 ID 유니크 인덱스 `UX_BGDOCM_FDOC_TARGET`, 라우트 `/admin/form-guides`

- [ ] **Step 1: 실패하는 사전 진단 SQL을 작성한다**

```sql
SELECT DOC_TTL_CONE, COUNT(*)
  FROM ITPOWN.TPRMPP_BGDOCM
 WHERE DEL_YN = 'N'
   AND DOC_MNG_NO LIKE 'FDOC-%'
 GROUP BY DOC_TTL_CONE
HAVING COUNT(*) > 1;
```

검증 파일에 인덱스, 라우트 카탈로그, 메뉴, 영어 번역 `Form Guides`, `ITPAD001` 매핑이 각각 1건인지 확인하는 SELECT를 추가한다.

- [ ] **Step 2: 현재 스키마에서 검증 SQL이 미구현 상태를 보고하는지 확인한다**

Run: Oracle 콘솔에서 `migrations/_verify/form-guide-and-menu-verify.sql`
Expected: 중복 진단은 0건이고 인덱스·메뉴 관련 검증은 0건 또는 객체 없음 오류다.

- [ ] **Step 3: 재실행 안전한 마이그레이션을 작성한다**

```sql
CREATE UNIQUE INDEX ITPOWN.UX_BGDOCM_FDOC_TARGET
    ON ITPOWN.TPRMPP_BGDOCM (
        CASE
            WHEN DEL_YN = 'N' AND DOC_MNG_NO LIKE 'FDOC-%'
            THEN DOC_TTL_CONE
        END
    );
```

`V20260820_005__SeedWasLogAdminMenu.sql`의 카탈로그 MERGE, 메뉴 채번, `TPRMPP_CMENUA`, `TPRMCM_TLNGXM` 패턴을 그대로 따라 `/admin/form-guides`와 `길라잡이 관리`를 시드한다.

- [ ] **Step 4: Flyway와 검증 SQL을 실행한다**

Run: 로컬 Flyway 적용 후 검증 SQL 실행
Expected: 마이그레이션 success, checksum 기록, 인덱스 1개, 메뉴/권한/영문 번역 각 1건.

- [ ] **Step 5: DB 변경을 커밋한다**

```powershell
git -C C:\it\it_database add -- migrations/V20260825_001__AddFormGuideUniquenessAndAdminMenu.sql migrations/_verify/form-guide-and-menu-verify.sql
git -C C:\it\it_database commit -m "feat(guide): 입력 길라잡이 제약과 관리자 메뉴 추가"
```

### Task 2: 서버 길라잡이 카탈로그와 저장소 조회 계약

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/document/formguide/FormGuideCatalog.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/document/formguide/FormGuideScope.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/repository/GuideDocRepository.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/document/formguide/FormGuideCatalogTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/document/repository/FormGuideRepositoryIt.java`

**Interfaces:**
- Produces: `FormGuideCatalog.Entry(String guideId, FormGuideScope scope, String section, String fieldLabel, String controlType)`, `require(String)`, `entries(FormGuideScope)`
- Produces: `findActiveFormGuides(String prefix, String guideIdPrefix)`와 `findByDocTtlConeAndDocMngNoStartingWithAndDelYn(...)`

- [ ] **Step 1: 카탈로그와 저장소 실패 테스트를 작성한다**

```java
assertThat(FormGuideCatalog.require("info.basic.abusNm").scope())
        .isEqualTo(FormGuideScope.INFO);
assertThatThrownBy(() -> FormGuideCatalog.require("info.unknown"))
        .isInstanceOf(IllegalArgumentException.class);
```

Oracle 통합 테스트에는 `GDOC-*`, `FDOC-*`, 삭제 FDOC, 빈 본문을 저장하고 활성 scope 조회가 본문 있는 FDOC만 반환하는 단언을 넣는다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew test --tests '*FormGuideCatalogTest' --tests '*FormGuideRepositoryIt'`
Expected: 새 타입과 저장소 메서드가 없어 컴파일 실패.

- [ ] **Step 3: 고정 카탈로그와 쿼리를 최소 구현한다**

```java
public record Entry(String guideId, FormGuideScope scope, String section,
                    String fieldLabel, String controlType) {}

public static Entry require(String guideId) {
    return BY_ID.entrySet().stream()
            .filter(entry -> entry.getKey().equals(guideId))
            .map(Map.Entry::getValue)
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("지원하지 않는 길라잡이 ID입니다"));
}
```

폼의 실제 모델명과 섹션을 전수 조사해 `info.*`와 `cost.*`를 모두 명시하고, 소요자원은 열별 ID만 둔다. 쿼리는 `DOC_MNG_NO LIKE 'FDOC-%'`, `DEL_YN='N'`, `DOC_TTL_CONE LIKE :scopePrefix`, `NAC_TXT_INF IS NOT NULL`과 공백 제거 조건을 DB에 적용한다.

- [ ] **Step 4: 대상 테스트를 통과시킨다**

Run: `./gradlew test --tests '*FormGuideCatalogTest' --tests '*FormGuideRepositoryIt'`
Expected: PASS.

- [ ] **Step 5: 백엔드 카탈로그 변경을 커밋한다**

```powershell
git add -- src/main/java/com/kdb/it/domain/budget/document/formguide src/main/java/com/kdb/it/domain/budget/document/repository/GuideDocRepository.java src/test/java/com/kdb/it/domain/budget/document/formguide src/test/java/com/kdb/it/domain/budget/document/repository/FormGuideRepositoryIt.java
git commit -m "feat(guide): 입력 필드 카탈로그와 조회 계약 추가"
```

### Task 3: 공개 일괄 조회 및 관리자 CRUD API

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/document/formguide/FormGuideDto.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/document/formguide/FormGuideService.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/document/formguide/FormGuideController.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/document/formguide/AdminFormGuideController.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/document/formguide/FormGuideServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/document/formguide/FormGuideControllerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/document/formguide/AdminFormGuideControllerTest.java`

**Interfaces:**
- Produces: `List<FormGuideDto.PublicResponse> getPublished(FormGuideScope scope)`
- Produces: `List<FormGuideDto.CatalogResponse> getCatalog(FormGuideScope scope)`, `String save(String guideId, SaveRequest)`, `void delete(String guideId)`
- Produces: `GET /api/form-guides`, `GET/PUT/DELETE /api/admin/form-guides/**`

- [ ] **Step 1: 서비스와 보안 계약 실패 테스트를 작성한다**

```java
assertThat(service.save("info.basic.abusNm", new SaveRequest("<script>x</script><p>안내</p>")))
        .startsWith("FDOC-");
verify(repository).save(argThat(doc -> doc.getNacTxtInf().equals("<p>안내</p>")));
```

MockMvc 테스트는 인증 사용자 공개 GET 200, 비인증 401, 관리자 PUT/DELETE 200·204, 일반 사용자 403, 미지원 ID 400, 중복 409, 미등록 삭제 404를 각각 검증한다.

- [ ] **Step 2: 새 API가 없어 실패하는지 확인한다**

Run: `./gradlew test --tests '*FormGuideServiceTest' --tests '*FormGuideControllerTest' --tests '*AdminFormGuideControllerTest'`
Expected: 컴파일 또는 404 실패.

- [ ] **Step 3: DTO·서비스·컨트롤러를 구현한다**

```java
public record PublicResponse(String guideId, String fieldLabel, String contentHtml) {}
public record SaveRequest(@NotBlank String contentHtml) {}

@PreAuthorize("hasRole('ADMIN')")
@RestController
@RequestMapping("/api/admin/form-guides")
class AdminFormGuideController { }
```

신규 채번은 기존 시퀀스에 `FDOC-%d-%04d`를 적용한다. 저장 전 `HtmlSanitizer.sanitize`, 카탈로그 검증, scope 검증을 수행하고 데이터 제약 위반은 프로젝트 공통 예외 매핑으로 409를 반환한다.

- [ ] **Step 4: API 대상 테스트를 통과시킨다**

Run: `./gradlew test --tests '*FormGuide*'`
Expected: PASS.

- [ ] **Step 5: API를 커밋한다**

```powershell
git add -- src/main/java/com/kdb/it/domain/budget/document/formguide src/test/java/com/kdb/it/domain/budget/document/formguide
git commit -m "feat(guide): 입력 길라잡이 조회와 관리 API 추가"
```

### Task 4: 기존 단계별 가이드 GDOC 경계와 관리자 쓰기 권한

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/GuideDocController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/GuideDocService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/repository/GuideDocRepository.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/document/controller/GuideDocControllerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/GuideDocServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/document/repository/GuideDocListProjectionIt.java`

**Interfaces:**
- Consumes: 기존 `/api/guide-documents` 계약
- Produces: 모든 기존 조회/명령의 `GDOC-*` 격리, POST/PUT/DELETE 관리자 제한

- [ ] **Step 1: FDOC 비노출과 권한 실패 테스트를 먼저 추가한다**

```java
mockMvc.perform(post("/api/guide-documents").with(user("user").roles("USER"))
        .contentType(APPLICATION_JSON).content(validBody))
        .andExpect(status().isForbidden());
```

목록 통합 테스트에 FDOC 행을 추가하고 결과에 포함되지 않음을 단언하며, FDOC 단건/수정/삭제는 존재하지 않는 문서로 처리되는지 검증한다.

- [ ] **Step 2: 회귀 테스트가 실패하는지 확인한다**

Run: `./gradlew test --tests '*GuideDocControllerTest' --tests '*GuideDocServiceTest' --tests '*GuideDocListProjectionIt'`
Expected: 기존 API가 FDOC를 노출하거나 일반 사용자 쓰기를 허용해 FAIL.

- [ ] **Step 3: GDOC 조건과 메서드 수준 권한을 구현한다**

```java
@PreAuthorize("hasRole('ADMIN')")
@PostMapping
public ResponseEntity<String> createDocument(...) { ... }
```

저장소 목록과 단건 조회 모두 `docMngNoStartingWith("GDOC-")` 조건을 적용하고, 클라이언트가 직접 지정한 비-GDOC 관리번호는 400으로 거부한다.

- [ ] **Step 4: 기존 가이드 회귀 테스트를 통과시킨다**

Run: `./gradlew test --tests '*GuideDoc*'`
Expected: PASS.

- [ ] **Step 5: 경계 강화를 커밋한다**

```powershell
git add -- src/main/java/com/kdb/it/domain/budget/document src/test/java/com/kdb/it/domain/budget/document
git commit -m "fix(guide): 단계별 가이드 GDOC 경계와 쓰기 권한 강화"
```

### Task 5: 프론트 API 타입과 길라잡이 상태 모델

**Files:**
- Create: `it_frontend/app/composables/project/useFormGuide.ts`
- Test: `it_frontend/tests/unit/composables/project/useFormGuide.test.ts`
- Modify (generated): `it_frontend/app/types/api.d.ts`

**Interfaces:**
- Produces: `FormGuideScope`, `FormGuideItem`, `useFormGuide(scope)`
- Produces: `activate(guideId: string): void`, `activeGuide: ComputedRef<FormGuideItem | null>`, `retry(): Promise<void>`

- [ ] **Step 1: 상태 모델 실패 테스트를 작성한다**

```ts
activate('info.basic.abusNm');
expect(activeGuide.value?.guideId).toBe('info.basic.abusNm');
activate('info.basic.missing');
expect(activeGuide.value).toBeNull();
```

초기 일괄 조회 1회, scope 쿼리, 실패 시 기존 패널 숨김과 오류 1회, 명시적 retry 동작을 검증한다.

- [ ] **Step 2: OpenAPI 타입을 재생성하고 테스트 실패를 확인한다**

Run: 백엔드 기동 후 `npm run codegen`, 이어서 `npm test -- useFormGuide.test.ts`
Expected: composable 미구현으로 FAIL.

- [ ] **Step 3: composable을 최소 구현한다**

```ts
export interface FormGuideItem {
    guideId: string;
    fieldLabel: string;
    contentHtml: string;
}

const activeGuide = computed(() => items.value.find((item) => item.guideId === activeId.value) ?? null);
```

조회는 `useApiFetch`, 재시도는 같은 fetch의 `useRefreshGuard`를 사용하고 scope가 바뀌면 다른 조회 상태를 사용한다.

- [ ] **Step 4: 타입과 상태 테스트를 통과시킨다**

Run: `npm run codegen:check; npm test -- useFormGuide.test.ts`
Expected: PASS.

- [ ] **Step 5: 프론트 API 기반을 커밋한다**

```powershell
git add -- app/types/api.d.ts app/composables/project/useFormGuide.ts tests/unit/composables/project/useFormGuide.test.ts
git commit -m "feat(guide): 폼 길라잡이 조회 상태 추가"
```

### Task 6: 반응형 GuidePanel과 입력 활성화 어댑터

**Files:**
- Create: `it_frontend/app/components/projects/FormGuidePanel.vue`
- Create: `it_frontend/app/composables/project/useFormGuideActivation.ts`
- Test: `it_frontend/tests/unit/components/FormGuidePanel.test.ts`
- Test: `it_frontend/tests/unit/composables/project/useFormGuideActivation.test.ts`

**Interfaces:**
- Consumes: `FormGuideItem | null`, `activate(guideId)`
- Produces: `useFormGuideActivation(activate)`의 폼 컨테이너 focus/click 이벤트 위임

- [ ] **Step 1: 렌더링과 이벤트 실패 테스트를 작성한다**

```ts
expect(wrapper.find('[data-testid="form-guide-panel"]').exists()).toBe(false);
await wrapper.setProps({ guide: populatedGuide });
expect(wrapper.html()).toContain('사업명 길라잡이');
expect(wrapper.html()).not.toContain('<script>');
```

활성화 테스트는 `data-guide-id`를 가진 input focus, Select click, DatePicker 버튼 click, 동적 행 재마운트가 같은 ID를 `activate`에 전달하는지 검증한다.

- [ ] **Step 2: 컴포넌트와 지시자가 없어 실패하는지 확인한다**

Run: `npm test -- FormGuidePanel.test.ts useFormGuideActivation.test.ts`
Expected: 모듈을 찾지 못해 FAIL.

- [ ] **Step 3: 패널과 이벤트 위임 composable을 구현한다**

```vue
<aside v-if="guide && sanitizedHtml" data-testid="form-guide-panel" class="form-guide-panel">
    <h2>{{ guide.fieldLabel }}</h2>
    <div class="form-guide-panel__content" v-html="sanitizedHtml" />
</aside>
```

데스크톱은 `position: sticky`와 280~320px 열, 작은 화면은 폼 아래 접이식 카드가 되도록 디자인 토큰만 사용한다. `isomorphic-dompurify`로 HTML을 정화한다.

```ts
const resolveGuideId = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>('[data-guide-id]')?.dataset.guideId : undefined;
```

폼 컨테이너의 capture 단계 `focusin`과 `click`에서 가장 가까운 `data-guide-id`를 찾아 활성화한다. 이 방식으로 PrimeVue 내부 input/button과 동적 소요자원 행을 별도 전역 지시자 없이 처리한다.

- [ ] **Step 4: 컴포넌트 테스트와 스타일 린트를 통과시킨다**

Run: `npm test -- FormGuidePanel.test.ts useFormGuideActivation.test.ts; npm run lint:css`
Expected: PASS.

- [ ] **Step 5: 공통 UI를 커밋한다**

```powershell
git add -- app/components/projects/FormGuidePanel.vue app/composables/project/useFormGuideActivation.ts tests/unit/components/FormGuidePanel.test.ts tests/unit/composables/project/useFormGuideActivation.test.ts
git commit -m "feat(guide): 반응형 길라잡이 패널 추가"
```

### Task 7: 정보화·경상 폼 전체 필드 연결

**Files:**
- Modify: `it_frontend/app/pages/info/projects/form.vue`
- Modify: `it_frontend/app/components/projects/ProjectFormCriteriaFields.vue`
- Modify: `it_frontend/app/components/projects/ProjectFormProgressFields.vue`
- Modify: `it_frontend/app/components/projects/ResourceTableSection.vue`
- Modify: `it_frontend/app/composables/useProjectFormPage.ts`
- Test: `it_frontend/tests/unit/pages/project-form-guide-contract.test.ts`
- Test: `it_frontend/tests/e2e/project-form-guide.spec.ts`

**Interfaces:**
- Consumes: `useFormGuide(scope)`, `useFormGuideActivation(activate)`, `FormGuidePanel`
- Produces: 모든 사업 데이터 편집 컨트롤과 서버 카탈로그의 1:1 ID 계약

- [ ] **Step 1: 카탈로그 누락을 검출하는 실패 테스트를 작성한다**

```ts
expect(new Set(extractGuideIds(projectFormSources))).toEqual(new Set(serverCatalogFixtureIds));
```

테스트 fixture는 Task 2 카탈로그 응답을 고정해 `info.*`/`cost.*`가 모두 존재하고, 소요자원 ID에 행 인덱스가 없으며, 저장·검색·첨부 요소에는 ID가 없음을 검증한다.

- [ ] **Step 2: 계약 테스트가 누락 필드 때문에 실패하는지 확인한다**

Run: `npm test -- project-form-guide-contract.test.ts`
Expected: 현재 폼에 guide ID가 없어 FAIL.

- [ ] **Step 3: 폼 유형 계산과 모든 대상 필드를 연결한다**

```vue
<Textarea :data-guide-id="`${guideScope}.overview.saf`" v-model="form.saf" />
<FormGuidePanel :guide="activeGuide" />
```

페이지의 2열 레이아웃에 패널을 두고 작은 화면에서는 폼 아래로 순서를 바꾼다. 자식 컴포넌트에는 `guideScope`와 `activateGuide`를 props로 전달한다. 소요자원 행은 `${guideScope}.resource.currency`처럼 열 ID를 사용한다.

- [ ] **Step 4: 단위 및 E2E 시나리오를 통과시킨다**

Run: `npm test -- project-form-guide-contract.test.ts; npm run test:e2e -- project-form-guide.spec.ts`
Expected: 정보화/경상 분리, 빈 본문 숨김, 필드 전환, 동적 행 공유가 PASS.

- [ ] **Step 5: 폼 연결을 커밋한다**

```powershell
git add -- app/pages/info/projects/form.vue app/components/projects/ProjectFormCriteriaFields.vue app/components/projects/ProjectFormProgressFields.vue app/components/projects/ResourceTableSection.vue app/composables/useProjectFormPage.ts tests/unit/pages/project-form-guide-contract.test.ts tests/e2e/project-form-guide.spec.ts
git commit -m "feat(guide): 사업 폼 전체 입력에 길라잡이 연결"
```

### Task 8: 관리자 길라잡이 관리 화면

**Files:**
- Create: `it_frontend/app/pages/admin/form-guides/index.vue`
- Create: `it_frontend/app/composables/admin/useFormGuideAdmin.ts`
- Modify: `it_frontend/i18n/messages/admin.ts`
- Modify: `it_frontend/i18n/messages/project.ts`
- Test: `it_frontend/tests/unit/composables/admin/useFormGuideAdmin.test.ts`
- Test: `it_frontend/tests/unit/pages/admin-form-guides.test.ts`
- Test: `it_frontend/tests/e2e/admin-form-guides.spec.ts`

**Interfaces:**
- Consumes: `/api/admin/form-guides/catalog`, PUT/DELETE by `guideId`, `TiptapEditor`
- Produces: `/admin/form-guides` 관리자 페이지

- [ ] **Step 1: 관리자 API 호출과 화면 상태 실패 테스트를 작성한다**

```ts
await saveGuide('info.basic.abusNm', '<p>안내</p>');
expect($apiFetch).toHaveBeenCalledWith(expect.stringContaining('info.basic.abusNm'), {
    method: 'PUT', body: { contentHtml: '<p>안내</p>' },
});
```

화면 테스트는 scope→section→field 선택, ID 읽기 전용, 미등록 `신규 등록`, 등록 `저장/삭제`, 성공 뒤 guarded refresh, 실패 시 공통 오류 매핑을 검증한다.

- [ ] **Step 2: 관리자 테스트가 미구현으로 실패하는지 확인한다**

Run: `npm test -- useFormGuideAdmin.test.ts admin-form-guides.test.ts`
Expected: 새 모듈과 페이지가 없어 FAIL.

- [ ] **Step 3: composable과 페이지를 구현한다**

```ts
const saveGuide = (guideId: string, contentHtml: string) =>
    $apiFetch(`${apiBase}/${encodeURIComponent(guideId)}`, {
        method: 'PUT', body: { contentHtml },
    });
```

페이지는 고정 카탈로그만 선택지로 사용하고 자유 ID 입력을 제공하지 않는다. 사용자 노출 문구는 한국어·영어 메시지 트리를 모두 완성한다.

- [ ] **Step 4: 관리자 단위/E2E 테스트를 통과시킨다**

Run: `npm test -- useFormGuideAdmin.test.ts admin-form-guides.test.ts; npm run test:e2e -- admin-form-guides.spec.ts`
Expected: PASS.

- [ ] **Step 5: 관리자 화면을 커밋한다**

```powershell
git add -- app/pages/admin/form-guides/index.vue app/composables/admin/useFormGuideAdmin.ts i18n/messages/admin.ts i18n/messages/project.ts tests/unit/composables/admin/useFormGuideAdmin.test.ts tests/unit/pages/admin-form-guides.test.ts tests/e2e/admin-form-guides.spec.ts
git commit -m "feat(guide): 관리자 길라잡이 관리 화면 추가"
```

### Task 9: 전체 Health Stack과 호환 버전 고정

**Files:**
- Modify: `versions.lock`
- Modify: `TASK_DONE.md`

**Interfaces:**
- Consumes: Tasks 1~8의 세 저장소 커밋
- Produces: 검증된 교차 저장소 커밋 조합

- [ ] **Step 1: 백엔드 전체 검증을 실행한다**

Run: `cd C:\it\it_backend; ./gradlew test; ./gradlew check; ./gradlew bootJar`
Expected: 모두 exit 0.

- [ ] **Step 2: 프론트 전체 검증을 실행한다**

Run: `cd C:\it\it_frontend; npm run format:check; npm run check; npm test; npm run lint:css; npm run test:e2e; npm run codegen:check`
Expected: 모두 exit 0.

- [ ] **Step 3: DB 적용 이력을 재확인한다**

Run: `flyway_schema_history`에서 `V20260825_001` success/checksum 확인 후 `form-guide-and-menu-verify.sql`
Expected: 중복 0건, 인덱스·메뉴·권한·번역 각 1건.

- [ ] **Step 4: 호환 버전과 완료 기록을 갱신한다**

Run: `cd C:\it; ./scripts/update-versions-lock.ps1`
Expected: `versions.lock`에 현재 backend/frontend/database 커밋이 기록됨. `TASK_DONE.md`에는 세 커밋과 검증 명령을 한 항목으로 기록한다.

- [ ] **Step 5: 루트 호환성 기록을 커밋한다**

```powershell
git add -- versions.lock TASK_DONE.md
git commit -m "chore: 입력 길라잡이 호환 버전 기록"
```
