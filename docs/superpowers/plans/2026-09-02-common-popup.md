# Common Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 `TPRMPP_BGDOCM`에 공통 안내를 게시하고, 인증 사용자가 어느 업무 화면으로 진입해도 콘텐츠 버전별 표준 안내 다이얼로그를 한 번 확인하도록 만든다.

**Architecture:** `DOC_TTL_CONE='common.popup'`인 활성 `GDOC-*` 한 건을 전용 백엔드 서비스와 공개/관리 API로 다룬다. 프론트는 `AppShell`에 전용 composable과 다이얼로그를 한 번 마운트하고 서버 버전과 1년 쿠키를 비교한다. 관리자 화면은 기존 담당자 정보 작성 화면 패턴을 따르되 게시 중지 기능을 제공한다.

**Tech Stack:** Java 21, Spring Boot, Spring Data JPA, Spring Security, Oracle/Flyway, JUnit 5, MockMvc, Nuxt 4, Vue 3 Composition API, TypeScript, PrimeVue, Tiptap, DOMPurify, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-09-02-common-popup-design.md`

## Global Constraints

- 기존 `TPRMPP_BGDOCM`을 공유하고 컬럼을 추가하지 않는다.
- 활성 문서의 `DOC_TTL_CONE`은 정확히 `common.popup`, 관리번호는 `GDOC-*`이다.
- 로그인 화면은 제외하고 공통 `AppShell`을 사용하는 인증 화면에서만 조회한다.
- 쿠키 이름은 `it-common-popup-dismissed-version`, `Path=/`, `SameSite=Lax`, 유효기간은 1년이다.
- 쿠키에는 서버의 `contentVersion`만 저장하고 인증·사용자·HTML 정보는 저장하지 않는다.
- 서버 저장 시 `HtmlSanitizer`, 브라우저 렌더 직전 DOMPurify를 모두 적용한다.
- 사용자 조회 실패는 업무 화면을 막거나 Toast를 띄우지 않는다.
- 신규 주석과 사용자 노출 문구는 한국어·영어 i18n 계약을 지킨다.
- 사용자 소유 변경인 `meta/backlog.md`와 `sample/2025/`는 수정하거나 커밋하지 않는다.

---

## File Map

- `it_database/migrations/V20260902_002__AddCommonPopupDocumentAndAdminMenu.sql`: 단일 활성 문서 인덱스와 관리자 메뉴·권한·번역 시드
- `it_database/docs/verification/V20260902_002__AddCommonPopupDocumentAndAdminMenu.verify.sql`: 배포 후 DB 계약 검증
- `it_backend/.../common/popup/CommonPopupDto.java`: 공개·관리 API 요청/응답 타입
- `it_backend/.../common/popup/CommonPopupService.java`: 조회·갱신·게시 중지와 콘텐츠 버전 생성
- `it_backend/.../common/popup/CommonPopupCreationService.java`: 동시 최초 저장에 안전한 독립 생성 트랜잭션
- `it_backend/.../common/popup/CommonPopupController.java`: 인증 사용자 조회 API
- `it_backend/.../common/popup/AdminCommonPopupController.java`: 관리자 조회·저장·게시 중지 API
- `it_backend/.../budget/document/repository/GuideDocRepository.java`: 활성 고정 구분자 조회 재사용
- `it_frontend/app/types/common-popup.ts`: 생성 API 타입 별칭과 UI 계약
- `it_frontend/app/composables/useCommonPopup.ts`: 조회, 쿠키 비교, 표시·닫기 상태
- `it_frontend/app/composables/admin/useCommonPopupAdmin.ts`: 관리자 API 어댑터
- `it_frontend/app/components/layout/CommonPopupDialog.vue`: 표준 사용자 다이얼로그
- `it_frontend/app/components/layout/AppShell.vue`: 공통 다이얼로그 단일 마운트
- `it_frontend/app/pages/admin/common-popup.vue`: 관리자 편집·게시 중지 화면
- `it_frontend/i18n/messages/admin.ts`, `it_frontend/i18n/messages/layout.ts`: 한국어·영어 문구
- `it_frontend/app/types/api.d.ts`: 백엔드 API 완료 직후 재생성하는 OpenAPI 타입

### Task 1: DB 단일 문서 및 관리자 메뉴 계약

**Files:**
- Create: `it_database/migrations/V20260902_002__AddCommonPopupDocumentAndAdminMenu.sql`
- Create: `it_database/docs/verification/V20260902_002__AddCommonPopupDocumentAndAdminMenu.verify.sql`

**Interfaces:**
- Consumes: `TPRMPP_BGDOCM`, `SQ_TPRMPP_CMENUM_1`, 상위 메뉴 `MADM0010`, 관리자 권한 `ITPAD001`
- Produces: `UX_BGDOCM_COMMON_POPUP`, 관리자 경로 `/admin/common-popup`

- [ ] **Step 1: 중복 사전 진단 SQL을 작성한다**

```sql
SELECT COUNT(*) AS DUPLICATE_GROUP_COUNT
  FROM (
        SELECT 1
          FROM ITPOWN.TPRMPP_BGDOCM
         WHERE DEL_YN = 'N'
           AND DOC_MNG_NO LIKE 'GDOC-%'
           AND DOC_TTL_CONE = 'common.popup'
         GROUP BY DOC_TTL_CONE
        HAVING COUNT(*) > 1
       );
```

- [ ] **Step 2: 함수 기반 유일 인덱스와 멱등 메뉴 시드를 작성한다**

`V20260902_001__AddContactInfoDocumentAndAdminMenu.sql`의 인덱스 존재 검사, `CMENUD` MERGE, `CMENUM` 생성, `CLANGM` 영문 번역, `CMENUA` 관리자 매핑 구조를 그대로 적용하되 다음 상수를 사용한다.

```sql
c_parent_id CONSTANT VARCHAR2(10) := 'MADM0010';
c_sre_pth   CONSTANT VARCHAR2(40) := '/admin/common-popup';
-- MNU_NM='안내 팝업 관리', IMK_NM='pi pi-megaphone'
-- 영문 MNU_NM='Notice Popup Management'
```

인덱스 표현식은 설계서의 `CASE ... DOC_TTL_CONE = 'common.popup' THEN 1 END`와 정확히 일치시킨다.

- [ ] **Step 3: 검증 SQL을 작성한다**

```sql
SELECT INDEX_NAME, UNIQUENESS FROM USER_INDEXES
 WHERE TABLE_NAME='TPRMPP_BGDOCM' AND INDEX_NAME='UX_BGDOCM_COMMON_POPUP';

SELECT m.MNU_ID, m.HRK_MNU_ID, m.MNU_NM, m.SRE_PTH, a.ATH_ID
  FROM TPRMPP_CMENUM m
  JOIN TPRMPP_CMENUA a ON a.MNU_ID=m.MNU_ID AND a.DEL_YN='N'
 WHERE m.SRE_PTH='/admin/common-popup' AND m.DEL_YN='N';
```

Expected: 유일 인덱스 1건, `MADM0010` 하위 활성 메뉴 1건, `ITPAD001` 매핑 1건, 영문 번역 1건, 활성 팝업 중복 그룹 0건.

- [ ] **Step 4: 정적 검사를 실행한다**

Run: `git diff --check -- it_database/migrations/V20260902_002__AddCommonPopupDocumentAndAdminMenu.sql it_database/docs/verification/V20260902_002__AddCommonPopupDocumentAndAdminMenu.verify.sql`

Expected: 출력 없음.

- [ ] **Step 5: DB 변경을 커밋한다**

```powershell
git add it_database/migrations/V20260902_002__AddCommonPopupDocumentAndAdminMenu.sql it_database/docs/verification/V20260902_002__AddCommonPopupDocumentAndAdminMenu.verify.sql
git commit -m "feat: 공통 안내 팝업 DB 계약 추가"
```

### Task 2: 공통 팝업 서비스와 버전 계약

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/popup/CommonPopupDto.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/popup/CommonPopupService.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/popup/CommonPopupCreationService.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/popup/CommonPopupServiceTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/popup/CommonPopupCreationServiceTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/repository/GuideDocRepository.java`

**Interfaces:**
- Consumes: `GuideDocRepository.findByDocTtlConeAndDocMngNoStartingWithAndDelYn(...)`, `Bgdocm.update(...)`, `Bgdocm.delete()`, `HtmlSanitizer.sanitize(...)`
- Produces: `CommonPopupService.getActivePopup(): Optional<CommonPopupDto.Response>`, `getAdminPopup(): AdminResponse`, `save(String): AdminResponse`, `stopPublishing(): void`

- [ ] **Step 1: 서비스 실패 테스트를 작성한다**

아래 행위를 각각 독립 테스트로 작성한다.

```java
assertThat(service.getActivePopup()).isEmpty();
assertThatThrownBy(() -> service.save("<script>x</script>"))
    .isInstanceOf(IllegalArgumentException.class);
verify(existing).update("common.popup", "<p>새 안내</p>");
verify(existing).delete();
```

버전 테스트의 고정 기대값은 다음과 같다.

```java
given(existing.getDocMngNo()).willReturn("GDOC-2026-0100");
given(existing.getLstChgDtm()).willReturn(LocalDateTime.parse("2026-09-02T10:20:30.123456"));
assertThat(response.contentVersion())
    .isEqualTo("GDOC-2026-0100:2026-09-02T10:20:30.123456");
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.popup.CommonPopupServiceTest' --tests 'com.kdb.it.common.popup.CommonPopupCreationServiceTest'`

Expected: 신규 클래스가 없어 컴파일 실패.

- [ ] **Step 3: DTO와 최소 서비스를 구현한다**

```java
public final class CommonPopupDto {
    @Schema(name = "CommonPopupSaveRequest")
    public record SaveRequest(@NotBlank String contentHtml) {}
    @Schema(name = "CommonPopupResponse")
    public record Response(String docMngNo, String contentHtml, String contentVersion) {}
    @Schema(name = "CommonPopupAdminResponse")
    public record AdminResponse(String docMngNo, String contentHtml, String contentVersion) {}
}
```

`CommonPopupService` 상수와 버전 함수는 다음 계약을 사용한다.

```java
public static final String DOCUMENT_IDENTIFIER = "common.popup";
private static final String DOCUMENT_NUMBER_PREFIX = "GDOC-";

private String contentVersion(Bgdocm document) {
    return document.getDocMngNo() + ":" + document.getLstChgDtm();
}
```

갱신은 `saveAndFlush` 후 DTO를 만들고, 최초 생성은 `REQUIRES_NEW` 서비스에서 시퀀스 채번·`saveAndFlush`한다. `DataIntegrityViolationException`이면 활성 문서를 다시 조회해 갱신한다. 게시 중지는 활성 문서가 있을 때만 `delete()`하고 flush한다.

- [ ] **Step 4: 서비스 테스트를 통과시킨다**

Run: `./gradlew test --tests 'com.kdb.it.common.popup.CommonPopupServiceTest' --tests 'com.kdb.it.common.popup.CommonPopupCreationServiceTest'`

Expected: PASS.

- [ ] **Step 5: 서비스 변경을 커밋한다**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/popup it_backend/src/test/java/com/kdb/it/common/popup it_backend/src/main/java/com/kdb/it/domain/budget/document/repository/GuideDocRepository.java
git commit -m "feat: 공통 안내 팝업 서비스 추가"
```

### Task 3: 공개 및 관리자 API

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/popup/CommonPopupController.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/popup/AdminCommonPopupController.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/popup/CommonPopupControllerTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/popup/AdminCommonPopupControllerTest.java`
- Modify: `it_frontend/app/types/api.d.ts`

**Interfaces:**
- Consumes: Task 2의 `CommonPopupService`
- Produces: `GET /api/common-popup`, `GET|PUT|DELETE /api/admin/common-popup`, 생성된 `CommonPopup*` TypeScript 타입

- [ ] **Step 1: MockMvc 실패 테스트를 작성한다**

사용자 API는 문서 존재 시 `200`, 미등록 시 `204`, 비인증 시 `401`을 검증한다. 관리자 API는 관리자 성공, 일반 사용자 `403`, 공백 요청 `400`을 검증한다.

```java
mockMvc.perform(get("/api/common-popup"))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.contentVersion").value(expectedVersion));

mockMvc.perform(delete("/api/admin/common-popup"))
    .andExpect(status().isNoContent());
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.popup.*ControllerTest'`

Expected: 컨트롤러가 없어 컴파일 실패.

- [ ] **Step 3: 최소 컨트롤러를 구현한다**

```java
@GetMapping
public ResponseEntity<CommonPopupDto.Response> getActivePopup() {
    return service.getActivePopup()
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.noContent().build());
}
```

관리 컨트롤러는 `@RequestMapping("/api/admin/common-popup")`과 클래스 수준 `@PreAuthorize("hasRole('ADMIN')")`를 적용한다. `PUT`은 `@Valid SaveRequest`, `DELETE`는 `204 No Content`를 반환한다.

- [ ] **Step 4: API 테스트를 통과시킨다**

Run: `./gradlew test --tests 'com.kdb.it.common.popup.*Test'`

Expected: PASS.

- [ ] **Step 5: OpenAPI 생성 타입을 갱신하고 확인한다**

백엔드를 프로젝트 표준 개발 명령으로 기동한 뒤 프론트엔드 디렉터리에서 실행한다.

```powershell
npm run codegen
npm run codegen:check
```

Expected: `app/types/api.d.ts`에 `/api/common-popup`, `/api/admin/common-popup`, `CommonPopupResponse`, `CommonPopupAdminResponse`, `CommonPopupSaveRequest`가 생성되고 검사도 통과한다. 생성 파일은 손으로 편집하지 않는다.

- [ ] **Step 6: API 변경을 커밋한다**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/popup it_backend/src/test/java/com/kdb/it/common/popup it_frontend/app/types/api.d.ts
git commit -m "feat: 공통 안내 팝업 API 추가"
```

### Task 4: 사용자 팝업 상태와 표준 다이얼로그

**Files:**
- Create: `it_frontend/app/types/common-popup.ts`
- Create: `it_frontend/app/composables/useCommonPopup.ts`
- Create: `it_frontend/app/components/layout/CommonPopupDialog.vue`
- Create: `it_frontend/tests/unit/composables/useCommonPopup.test.ts`
- Create: `it_frontend/tests/unit/components/layout/CommonPopupDialog.test.ts`
- Modify: `it_frontend/i18n/messages/layout.ts`

**Interfaces:**
- Consumes: generated `CommonPopupResponse`, `useApiFetch`, `useCookie`, DOMPurify, `AppDialogHeader`, `AppDialogFooter`
- Produces: `useCommonPopup(): CommonPopupController`, `<CommonPopupDialog :controller="commonPopup" />`

- [ ] **Step 1: 쿠키·노출 상태 실패 테스트를 작성한다**

```ts
expect(controller.visible.value).toBe(true);
controller.dismissForVersion.value = true;
controller.close();
expect(cookie.value).toBe('GDOC-2026-0100:2026-09-02T10:20:30.123456');
```

별도 테스트에서 버전 일치 시 숨김, 미체크 닫기 시 쿠키 미변경, `204`와 조회 오류 시 숨김을 검증한다.

- [ ] **Step 2: 다이얼로그 실패 테스트를 작성한다**

`Dialog`, `Checkbox`, `Button`을 stub하고 다음을 검증한다.

```ts
expect(wrapper.find('[data-testid="common-popup-content"] script').exists()).toBe(false);
await wrapper.get('[data-testid="common-popup-dismiss-checkbox"]').trigger('click');
await wrapper.get('[data-testid="common-popup-close"]').trigger('click');
expect(controller.close).toHaveBeenCalled();
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

Run: `npm test -- tests/unit/composables/useCommonPopup.test.ts tests/unit/components/layout/CommonPopupDialog.test.ts`

Expected: 신규 모듈을 찾지 못해 FAIL.

- [ ] **Step 4: 타입과 composable을 구현한다**

```ts
export interface CommonPopupController {
    popup: Ref<CommonPopupResponse | null>;
    visible: Ref<boolean>;
    dismissForVersion: Ref<boolean>;
    close: () => void;
}
```

```ts
const dismissedVersion = useCookie<string | null>('it-common-popup-dismissed-version', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
    secure: import.meta.env.PROD,
});
```

`useApiFetch` 성공 데이터의 버전이 쿠키와 다를 때만 `visible=true`로 만든다. `close()`는 체크된 경우에만 쿠키를 갱신하고 항상 현재 앱 셸에서는 닫는다.

- [ ] **Step 5: 표준 다이얼로그와 i18n을 구현한다**

`CommonPopupDialog.vue`는 `AppDialogHeader`, `AppDialogFooter`, `var(--dialog-lg)`, 비드래그 modal Dialog를 사용한다. 본문은 다음 계산값만 렌더한다.

```ts
const sanitizedHtml = computed(() =>
    DOMPurify.sanitize(props.controller.popup.value?.contentHtml ?? ''),
);
```

고정 문구 `layout.commonPopup.title`, `dismiss`, `close`를 한국어와 영어에 모두 추가한다.

- [ ] **Step 6: 단위 테스트를 통과시킨다**

Run: `npm test -- tests/unit/composables/useCommonPopup.test.ts tests/unit/components/layout/CommonPopupDialog.test.ts`

Expected: PASS.

- [ ] **Step 7: 사용자 팝업 변경을 커밋한다**

```powershell
git add it_frontend/app/types/common-popup.ts it_frontend/app/composables/useCommonPopup.ts it_frontend/app/components/layout/CommonPopupDialog.vue it_frontend/tests/unit/composables/useCommonPopup.test.ts it_frontend/tests/unit/components/layout/CommonPopupDialog.test.ts it_frontend/i18n/messages/layout.ts
git commit -m "feat: 공통 안내 팝업 다이얼로그 추가"
```

### Task 5: 관리자 안내 팝업 관리 화면

**Files:**
- Create: `it_frontend/app/composables/admin/useCommonPopupAdmin.ts`
- Create: `it_frontend/app/pages/admin/common-popup.vue`
- Create: `it_frontend/tests/unit/composables/admin/useCommonPopupAdmin.test.ts`
- Create: `it_frontend/tests/unit/pages/AdminCommonPopup.test.ts`
- Modify: `it_frontend/i18n/messages/admin.ts`

**Interfaces:**
- Consumes: generated `CommonPopupAdminResponse`, `CommonPopupSaveRequest`, `$apiFetch`, `useApiFetch`, `TiptapEditor`
- Produces: 관리자 조회·저장·게시 중지 UI

- [ ] **Step 1: 관리자 API 어댑터 실패 테스트를 작성한다**

```ts
expect(fetchMock).toHaveBeenCalledWith(endpoint, expect.objectContaining({ method: 'PUT' }));
expect(fetchMock).toHaveBeenCalledWith(endpoint, expect.objectContaining({ method: 'DELETE' }));
```

- [ ] **Step 2: 관리자 페이지 실패 테스트를 작성한다**

기존 본문 반영, 저장 시 현재 HTML 전달, 등록 문서가 있을 때만 게시 중지 버튼 노출, 확인 후 DELETE 및 화면 초기화를 검증한다.

```ts
expect(savePopupMock).toHaveBeenCalledWith('<p>변경 안내</p>');
expect(stopPublishingMock).toHaveBeenCalledTimes(1);
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

Run: `npm test -- tests/unit/composables/admin/useCommonPopupAdmin.test.ts tests/unit/pages/AdminCommonPopup.test.ts`

Expected: 신규 모듈을 찾지 못해 FAIL.

- [ ] **Step 4: composable과 페이지를 구현한다**

```ts
const endpoint = `${config.public.apiBase}/api/admin/common-popup`;
const savePopup = (contentHtml: string) =>
    $apiFetch<CommonPopupAdminResponse>(endpoint, { method: 'PUT', body: { contentHtml } });
const stopPublishing = () => $apiFetch<void>(endpoint, { method: 'DELETE' });
```

페이지는 `definePageMeta({ middleware: 'admin' })`, `PageHeader`, `TiptapEditor`, 공통 Toast와 오류 매핑을 사용한다. 게시 중지는 `useConfirm()` 확인 뒤 수행하고 성공 시 본문·문서번호를 초기화한다.

- [ ] **Step 5: 한국어·영어 문구를 추가한다**

`admin.commonPopup` 아래에 title, subtitle, editorTitle, identifier(`common.popup`), unregistered, loading, placeholder, validation, actions.stop, confirm, error, toast를 같은 키 구조로 추가한다.

- [ ] **Step 6: 관리자 단위 테스트를 통과시킨다**

Run: `npm test -- tests/unit/composables/admin/useCommonPopupAdmin.test.ts tests/unit/pages/AdminCommonPopup.test.ts`

Expected: PASS.

- [ ] **Step 7: 관리자 화면을 커밋한다**

```powershell
git add it_frontend/app/composables/admin/useCommonPopupAdmin.ts it_frontend/app/pages/admin/common-popup.vue it_frontend/tests/unit/composables/admin/useCommonPopupAdmin.test.ts it_frontend/tests/unit/pages/AdminCommonPopup.test.ts it_frontend/i18n/messages/admin.ts
git commit -m "feat: 안내 팝업 관리 화면 추가"
```

### Task 6: AppShell 통합과 E2E 계약

**Files:**
- Modify: `it_frontend/app/components/layout/AppShell.vue`
- Create: `it_frontend/tests/unit/components/layout/AppShellCommonPopup.test.ts`
- Create: `it_frontend/tests/e2e/common-popup.spec.ts`

**Interfaces:**
- Consumes: Task 3의 OpenAPI, Task 4의 `useCommonPopup`과 `CommonPopupDialog`
- Produces: 모든 인증 업무 화면의 단일 공통 팝업 마운트

- [ ] **Step 1: AppShell 통합 실패 테스트를 작성한다**

```ts
expect(useCommonPopupMock).toHaveBeenCalledTimes(1);
expect(wrapper.findComponent(CommonPopupDialogStub).props('controller')).toBe(controller);
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- tests/unit/components/layout/AppShellCommonPopup.test.ts`

Expected: 다이얼로그가 없어 FAIL.

- [ ] **Step 3: AppShell에 공통 팝업을 한 번 연결한다**

```ts
const commonPopup = useCommonPopup();
```

```vue
<CommonPopupDialog :controller="commonPopup" />
```

MFA 다이얼로그와 같은 전역 오버레이 위치에 두며 별도 layout을 추가하지 않는다.

- [ ] **Step 4: OpenAPI 생성 타입이 최신인지 확인한다**

Run: `npm run codegen:check`

Expected: PASS. Task 3에서 생성한 API 타입과 현재 백엔드 계약이 일치한다.

- [ ] **Step 5: E2E 시나리오를 작성한다**

`common-popup.spec.ts`에서 API를 route mock하여 다음을 검증한다.

- `/info` 직접 진입 시 팝업 표시
- `/budget` 직접 진입 시 팝업 표시
- 체크 후 닫고 새로고침하면 같은 버전 숨김
- 다른 `contentVersion` 응답으로 새로고침하면 다시 표시
- API `500`이어도 현재 페이지 내용은 표시되고 팝업은 없음

- [ ] **Step 6: 통합 단위 테스트를 통과시킨다**

Run: `npm test -- tests/unit/components/layout/AppShellCommonPopup.test.ts`

Expected: PASS.

- [ ] **Step 7: 통합 변경을 커밋한다**

```powershell
git add it_frontend/app/components/layout/AppShell.vue it_frontend/tests/unit/components/layout/AppShellCommonPopup.test.ts it_frontend/tests/e2e/common-popup.spec.ts
git commit -m "feat: 인증 화면에 공통 안내 팝업 연결"
```

### Task 7: 전체 회귀 검증과 문서 반영

**Files:**
- Modify: `README.md`
- Modify: `TASK_DONE.md`

**Interfaces:**
- Consumes: Tasks 1–6의 완성 기능
- Produces: 검증 증거와 사용자용 변경 기록

- [ ] **Step 1: 기능별 백엔드 테스트를 실행한다**

Run: `./gradlew test --tests 'com.kdb.it.common.popup.*Test'`

Expected: PASS.

- [ ] **Step 2: 백엔드 전체 검증을 실행한다**

```powershell
./gradlew test
./gradlew check
./gradlew bootJar
```

Expected: 세 명령 모두 exit code 0.

- [ ] **Step 3: 프론트엔드 전체 검증을 실행한다**

```powershell
npm run format:check
npm run check
npm test
npm run lint:css
npm run codegen:check
```

Expected: 모두 exit code 0.

- [ ] **Step 4: 공통 팝업 E2E를 실행한다**

Run: `npx playwright test tests/e2e/common-popup.spec.ts`

Expected: PASS. 실행 환경 문제로 불가능하면 명령과 원인을 최종 보고에 정확히 기록한다.

- [ ] **Step 5: 변경 기록을 갱신한다**

`README.md` 변경 이력과 `TASK_DONE.md`에 다음 계약을 짧게 기록한다.

```text
TPRMPP_BGDOCM의 common.popup 문서를 관리자가 게시하면 인증 화면의 AppShell에서
콘텐츠 버전별 안내 다이얼로그를 표시하고, 다시 보지 않기는 1년 쿠키로 관리한다.
```

- [ ] **Step 6: 최종 diff를 검사한다**

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: 사용자 소유 변경 외에는 계획된 파일만 존재하고 whitespace 오류가 없다.

- [ ] **Step 7: 검증·문서 변경을 커밋한다**

```powershell
git add README.md TASK_DONE.md
git commit -m "docs: 공통 안내 팝업 사용 계약 기록"
```
