# 한국어·영어 다국어 프론트 기반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nuxt 애플리케이션에 한국어 기본 쿠키 기반 i18n을 도입하고, 언어 선택·PrimeVue·포맷터·메뉴·탭·공통코드·오류 처리까지 하나의 반응형 locale로 연결한다.

**Architecture:** `@nuxtjs/i18n`은 URL을 바꾸지 않는 `no_prefix` 전략과 도메인별 메시지 파일을 제공한다. `useAppLocale`이 쿠키 정규화와 locale 변경을 담당하고 초기화 플러그인이 SSR/CSR 첫 렌더 전에 이를 적용한다. DB 번역 데이터는 `lang` 쿼리가 포함된 메뉴·공통코드 파사드만 통과하며, 탭과 PrimeVue는 locale 변경 이벤트에 반응해 제자리에서 재계산한다.

**Tech Stack:** Nuxt 4.4.6, Vue 3, TypeScript 6, `@nuxtjs/i18n` 10.6.0, Vue I18n, PrimeVue 4.5.4, Vitest, Vue Test Utils, Playwright.

**Depends on:** `docs/superpowers/plans/2026-08-15-multilingual-i18n-db-backend.md`의 최종 OpenAPI 계약

## Global Constraints

- locale 타입은 `'ko' | 'en'`, 기본값은 `ko`, 쿠키명은 `it-portal-locale`이다.
- `strategy: 'no_prefix'`, 브라우저 언어 자동 감지는 비활성화한다.
- 언어 변경은 `navigateTo`, `location.reload`, `reloadNuxtApp`을 호출하지 않는다.
- 번역 키는 의미 기반 영문 경로를 사용하고 한국어 문장을 키로 쓰지 않는다.
- 한국어·영어 메시지 파일은 동일한 key tree를 유지한다.
- 코드 ID·라우트 path·API 오류코드·저장값은 번역하지 않는다.
- 신규 `.ts`/`.vue` 파일은 800줄 이하를 유지한다.
- 프론트의 기존 dirty 파일과 package-lock 변경을 먼저 확인하고 충돌 시 사용자 변경을 보존한다.

---

### Task 1: Nuxt i18n 모듈과 메시지 계약

**Files:**
- Modify: `it_frontend/package.json`
- Modify: `it_frontend/package-lock.json`
- Modify: `it_frontend/nuxt.config.ts`
- Create: `it_frontend/i18n/locales/ko.ts`
- Create: `it_frontend/i18n/locales/en.ts`
- Create: `it_frontend/i18n/locales/ko/common.json`
- Create: `it_frontend/i18n/locales/en/common.json`
- Create: `it_frontend/i18n/locales/ko/layout.json`
- Create: `it_frontend/i18n/locales/en/layout.json`
- Create: `it_frontend/i18n/locales/ko/auth.json`
- Create: `it_frontend/i18n/locales/en/auth.json`
- Create: `it_frontend/i18n/locales/ko/errors.json`
- Create: `it_frontend/i18n/locales/en/errors.json`
- Create: `it_frontend/app/types/i18n.ts`
- Create: `it_frontend/tests/unit/i18n/messages.test.ts`

**Interfaces:**
- Produces: `AppLocale = 'ko' | 'en'`, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `LOCALE_COOKIE_NAME`
- Produces initial namespaces: `common`, `layout`, `auth`, `errors`

- [ ] **Step 1: 메시지 key parity 실패 테스트를 작성한다**

테스트는 `ko.ts`와 `en.ts`가 반환하는 객체를 재귀적으로 평탄화해 키 집합이 정확히 같고 모든 leaf가 비어 있지 않은 문자열인지 검증한다. 최소 계약 키는 다음을 포함한다.

```text
common.actions.save/cancel/close/delete/edit/search/reset/confirm
common.language.ko/en/label
common.state.loading/empty/fallbackKorean
layout.header.theme/menu/account/logout
layout.tabs.close/closeOthers/closeAll/home
layout.breadcrumb.home
auth.login.title/id/password/submit
errors.generic/unauthorized/forbidden/notFound/server/requestId
```

- [ ] **Step 2: 테스트 RED를 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/i18n/messages.test.ts`

Expected: locale 모듈과 메시지 파일이 없어 import에 실패한다.

- [ ] **Step 3: 모듈 설치와 Nuxt 설정을 구현한다**

Run: `cd it_frontend && npm install @nuxtjs/i18n@^10.6.0`

`nuxt.config.ts`의 modules에 `@nuxtjs/i18n`을 추가하고 다음 계약을 사용한다.

```ts
i18n: {
  strategy: 'no_prefix',
  defaultLocale: 'ko',
  detectBrowserLanguage: false,
  langDir: 'locales',
  locales: [
    { code: 'ko', language: 'ko-KR', name: '한국어', file: 'ko.ts' },
    { code: 'en', language: 'en-US', name: 'English', file: 'en.ts' },
  ],
}
```

Nuxt i18n 10.6의 실제 schema가 `file`/`langDir` 상대 경로를 다르게 요구하면 설치된 타입과 module schema를 기준으로 경로만 조정하되 정책 값은 바꾸지 않는다. `ko.ts`/`en.ts`는 네 namespace JSON을 명시적으로 import하고 같은 최상위 객체 구조를 반환한다.

- [ ] **Step 4: 메시지·타입·빌드 검사를 실행한다**

Run: `cd it_frontend && npm test -- tests/unit/i18n/messages.test.ts && npm run typecheck`

Expected: key parity와 Nuxt 타입 검사가 통과한다.

- [ ] **Step 5: i18n 기반 slice를 커밋한다**

```powershell
git -C it_frontend add -- package.json package-lock.json nuxt.config.ts i18n app/types/i18n.ts tests/unit/i18n/messages.test.ts
git -C it_frontend diff --cached --check
git -C it_frontend commit -m "feat: configure Korean English i18n"
```

### Task 2: 쿠키 기반 locale 초기화와 변경

**Files:**
- Create: `it_frontend/app/composables/useAppLocale.ts`
- Create: `it_frontend/app/plugins/locale-init.ts`
- Modify: `it_frontend/app/app.vue`
- Create: `it_frontend/tests/unit/composables/useAppLocale.test.ts`
- Create: `it_frontend/tests/unit/plugins/locale-init.test.ts`

**Interfaces:**
- Produces: `normalizeAppLocale(value): AppLocale`, `initializeLocale(): Promise<void>`, `setAppLocale(locale): Promise<void>`
- Side effects: cookie, Vue I18n locale, `<html lang>`

- [ ] **Step 1: 초기화와 전환 실패 테스트를 작성한다**

다음 표를 모두 검증한다.

| 쿠키 입력 | 활성 locale | 정규화 후 쿠키 |
| --- | --- | --- |
| 없음 | `ko` | `ko` |
| `ko` | `ko` | `ko` |
| `en` | `en` | `en` |
| ` EN ` | `en` | `en` |
| `fr` | `ko` | `ko` |

`setAppLocale('en')` 후 route 객체, `window.location`, 현재 form ref가 바뀌지 않고 cookie와 `<html lang="en">`만 갱신되는지 단언한다. 쿠키 옵션은 `maxAge: 31536000`, `sameSite: 'lax'`, `path: '/'`다.

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/composables/useAppLocale.test.ts tests/unit/plugins/locale-init.test.ts`

Expected: composable과 plugin이 없어 실패한다.

- [ ] **Step 3: locale controller와 초기화 plugin을 구현한다**

`useAppLocale`은 `useI18n().locale`과 `useCookie<AppLocale>`를 한 곳에서만 변경한다. `locale-init.ts`는 앱 초기화 시 쿠키를 normalize하고 렌더 전에 `setLocale`을 기다린다. `app.vue`의 `useHead` 또는 controller watcher로 `<html lang>`을 `ko`/`en`에 반응시킨다. hydration 전에 서버와 클라이언트가 같은 cookie 값을 사용하게 `.client` 전용 plugin으로 만들지 않는다.

- [ ] **Step 4: 단위 테스트 GREEN을 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/composables/useAppLocale.test.ts tests/unit/plugins/locale-init.test.ts`

Expected: 쿠키 default/오염/전환과 html lang 테스트가 통과한다.

- [ ] **Step 5: locale 상태 slice를 커밋한다**

```powershell
git -C it_frontend add -- app/composables/useAppLocale.ts app/plugins/locale-init.ts app/app.vue tests/unit/composables/useAppLocale.test.ts tests/unit/plugins/locale-init.test.ts
git -C it_frontend commit -m "feat: persist app locale in cookie"
```

### Task 3: 공통 언어 선택기와 두 진입점 배치

**Files:**
- Create: `it_frontend/app/components/common/LocaleSwitcher.vue`
- Modify: `it_frontend/nuxt.config.ts`
- Modify: `it_frontend/app/components/layout/AppHeader.vue`
- Modify: `it_frontend/app/pages/login.vue`
- Create: `it_frontend/tests/unit/components/LocaleSwitcher.test.ts`
- Modify: `it_frontend/tests/unit/components/AppHeader.test.ts`
- Modify: `it_frontend/tests/unit/pages/login.test.ts`

**Interfaces:**
- Consumes: `useAppLocale`, `common.language.*`
- Produces: keyboard/accessibility 지원 `한국어 / English` 선택기

- [ ] **Step 1: 선택기와 배치 실패 테스트를 작성한다**

`LocaleSwitcher` 테스트는 현재 언어의 선택 상태, `aria-label`, 키보드/클릭 전환, `setAppLocale` 한 번 호출을 검증한다. Header에서는 테마 버튼 바로 옆, 로그인에서는 화면 우측 상단에 존재하는지 검증한다. 기존 Header 메뉴/로그아웃과 로그인 submit 테스트는 그대로 통과해야 한다.

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/components/LocaleSwitcher.test.ts tests/unit/components/AppHeader.test.ts tests/unit/pages/login.test.ts`

Expected: 컴포넌트와 배치가 없어 실패한다.

- [ ] **Step 3: 선택기를 구현한다**

PrimeVue `SelectButton` 또는 두 개의 접근 가능한 버튼을 사용하되 표시 텍스트는 각 언어의 고유 이름 `한국어`, `English`로 고정해 어느 locale에서도 식별 가능하게 한다. 언어 전환 중 중복 입력을 막고 완료 후 focus를 유지한다. `nuxt.config.ts`에 `public.multilingualEnabled: false`를 추가하고, 운영 노출은 마지막 계획의 feature flag 단계까지 감추도록 로그인/Header에서 동일 값을 읽는다.

- [ ] **Step 4: 컴포넌트 테스트 GREEN을 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/components/LocaleSwitcher.test.ts tests/unit/components/AppHeader.test.ts tests/unit/pages/login.test.ts`

Expected: 새 테스트와 기존 상호작용 테스트가 통과한다.

- [ ] **Step 5: 선택기 slice를 커밋한다**

```powershell
git -C it_frontend add -- app/components/common/LocaleSwitcher.vue nuxt.config.ts app/components/layout/AppHeader.vue app/pages/login.vue tests/unit/components/LocaleSwitcher.test.ts tests/unit/components/AppHeader.test.ts tests/unit/pages/login.test.ts
git -C it_frontend commit -m "feat: add locale switchers"
```

### Task 4: PrimeVue locale와 공통 Intl 포맷터

**Files:**
- Create: `it_frontend/app/locales/primevue/ko.ts`
- Create: `it_frontend/app/locales/primevue/en.ts`
- Create: `it_frontend/app/plugins/primevue-locale.ts`
- Create: `it_frontend/app/composables/useLocaleFormat.ts`
- Modify: `it_frontend/nuxt.config.ts`
- Create: `it_frontend/tests/unit/plugins/primevue-locale.test.ts`
- Create: `it_frontend/tests/unit/composables/useLocaleFormat.test.ts`

**Interfaces:**
- Produces: `formatDate`, `formatDateTime`, `formatNumber`, `formatCurrency`, `collator`
- Maps: `ko -> ko-KR`, `en -> en-US`

- [ ] **Step 1: locale 반응형 포맷 실패 테스트를 작성한다**

고정된 UTC 날짜와 숫자를 사용해 다음 literal 결과를 검증한다.

```text
ko date: 2026. 8. 15.
en date: 8/15/2026
ko number: 1,234,567
en number: 1,234,567
```

통화는 업무 currency code를 반드시 인자로 받고 `KRW`일 때 한국어/영어 locale 차이를 `Intl.NumberFormat.formatToParts`로 비교한다. PrimeVue plugin 테스트는 locale 변경 시 `usePrimeVue().config.locale` 객체가 한국어→영어로 교체되고 aria/filter/date 문구가 함께 바뀌는지 확인한다.

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/plugins/primevue-locale.test.ts tests/unit/composables/useLocaleFormat.test.ts`

Expected: locale 파일, plugin, formatter가 없어 실패한다.

- [ ] **Step 3: PrimeVue와 formatter를 구현한다**

`nuxt.config.ts`에 박힌 고정 한국어 locale 객체를 제거한다. `primevue-locale.ts`는 현재 app locale watcher를 `immediate: true`로 실행하고 설치된 PrimeVue locale 객체를 제자리 mutate하지 않고 언어별 객체로 교체한다. `useLocaleFormat`은 locale computed에서 Intl locale을 얻으며 명시하지 않은 통화 기호나 `원` 접미사를 덧붙이지 않는다.

- [ ] **Step 4: 포맷 테스트와 typecheck를 실행한다**

Run: `cd it_frontend && npm test -- tests/unit/plugins/primevue-locale.test.ts tests/unit/composables/useLocaleFormat.test.ts && npm run typecheck`

Expected: reactive locale와 Intl 테스트가 통과한다.

- [ ] **Step 5: UI locale slice를 커밋한다**

```powershell
git -C it_frontend add -- app/locales/primevue app/plugins/primevue-locale.ts app/composables/useLocaleFormat.ts nuxt.config.ts tests/unit/plugins/primevue-locale.test.ts tests/unit/composables/useLocaleFormat.test.ts
git -C it_frontend commit -m "feat: localize PrimeVue and formatters"
```

### Task 5: 메뉴·Breadcrumb·전체 탭 제목 반응성

**Files:**
- Modify: `it_frontend/app/types/menu.ts`
- Modify: `it_frontend/app/composables/useMenu.ts`
- Modify: `it_frontend/app/composables/useTabs.ts`
- Modify: `it_frontend/app/components/layout/AppHeader.vue`
- Modify: `it_frontend/app/components/layout/AppSidebar.vue`
- Modify: `it_frontend/app/components/layout/AppBreadcrumb.vue`
- Modify: `it_frontend/tests/unit/composables/useMenu.test.ts`
- Modify: `it_frontend/tests/unit/composables/useTabs.test.ts`
- Modify: `it_frontend/tests/unit/components/AppHeader.test.ts`
- Modify: `it_frontend/tests/unit/components/AppBreadcrumb.test.ts`
- Modify: `it_frontend/tests/unit/components/AppSidebarExternalLink.test.ts`

**Interfaces:**
- Produces: `/api/menus?lang={locale}` locale별 asyncData key
- Adds page meta compatibility: `titleKey`, `tabTitleKey`; retains `title`, `tabTitle` as migration fallback
- Produces: `relabelAllTabs(resolveTitle)` without changing path/order/component instance

- [ ] **Step 1: 언어 전환 메뉴·탭 실패 테스트를 작성한다**

테스트 시나리오는 한국어 메뉴로 3개 탭을 연 뒤 locale을 `en`으로 바꾸고 영어 트리를 응답한다. Header/Sidebar/Breadcrumb와 활성·비활성 탭 3개의 title이 모두 영어로 바뀌며 탭 path, order, active key, page component ref는 그대로인지 검증한다. 메뉴 요청 키에 locale이 포함돼 `ko/en` asyncData가 공유되지 않는지도 단언한다.

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/composables/useMenu.test.ts tests/unit/composables/useTabs.test.ts tests/unit/components/AppHeader.test.ts tests/unit/components/AppBreadcrumb.test.ts tests/unit/components/AppSidebarExternalLink.test.ts`

Expected: 메뉴 URL과 탭 title이 locale 변경에 반응하지 않아 실패한다.

- [ ] **Step 3: locale-aware 메뉴와 탭 relabel을 구현한다**

`useMenu`의 단일 요청 URL과 asyncData key를 locale computed에서 만든다. locale 변경 시 기존 상태를 먼저 비우지 말고 새 트리 성공 후 원자적으로 교체해 깜빡임을 줄인다. `useTabs`는 모든 저장 탭을 순회해 다음 순서로 title을 다시 계산한다.

1. `meta.tabTitleKey` 번역
2. 현재 locale의 DB 메뉴명
3. `meta.titleKey` 번역
4. `layout.breadcrumb.home`
5. 기존 `meta.tabTitle`/`meta.title` 전환 fallback
6. path 마지막 segment

Header의 현재 활성 탭만 재등록하는 watcher는 전체 relabel 호출로 바꾸고 중복 탭 생성은 막는다.

- [ ] **Step 4: 메뉴·레이아웃 테스트 GREEN을 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/composables/useMenu.test.ts tests/unit/composables/useTabs.test.ts tests/unit/components/AppHeader.test.ts tests/unit/components/AppBreadcrumb.test.ts tests/unit/components/AppSidebarExternalLink.test.ts`

Expected: 메뉴 모든 소비자와 열린 전체 탭이 같은 언어로 전환된다.

- [ ] **Step 5: 메뉴·탭 slice를 커밋한다**

```powershell
git -C it_frontend add -- app/types/menu.ts app/composables/useMenu.ts app/composables/useTabs.ts app/components/layout/AppHeader.vue app/components/layout/AppSidebar.vue app/components/layout/AppBreadcrumb.vue tests/unit/composables/useMenu.test.ts tests/unit/composables/useTabs.test.ts tests/unit/components
git -C it_frontend commit -m "feat: reactively localize menus and tabs"
```

### Task 6: 공통코드 locale 파사드와 한국어 Excel 해석

**Files:**
- Modify: `it_frontend/app/composables/useCodeOptions.ts`
- Modify: `it_frontend/app/composables/useBudgetPeriod.ts`
- Modify: `it_frontend/app/composables/useProjectCurrencies.ts`
- Modify: `it_frontend/app/composables/useCouncilCodes.ts`
- Modify: `it_frontend/app/composables/ioeCategoryHelpers.ts`
- Create: `it_frontend/app/composables/useKoreanCodeLookup.ts`
- Modify: `it_frontend/tests/unit/composables/useCodeOptions.test.ts`
- Create: `it_frontend/tests/unit/composables/useKoreanCodeLookup.test.ts`

**Interfaces:**
- Produces: 일반 표시 조회 `?lang={currentLocale}`
- Produces: 명칭→코드 역변환 전용 `useKoreanCodeLookup`의 고정 `?lang=ko`

- [ ] **Step 1: locale cache 분리와 Excel 정책 실패 테스트를 작성한다**

`useCodeOptions('PRJ_TP')`가 locale 변경 시 `/api/ccodem/PRJ_TP?lang=en`을 새 key로 요청하고 option value는 `cdva`, label은 localized `cdvaNm`을 유지하는지 검증한다. `useKoreanCodeLookup`은 앱 locale이 `en`이어도 `lang=ko`만 호출하고 한국어 명칭으로 코드값을 찾는지 확인한다.

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/composables/useCodeOptions.test.ts tests/unit/composables/useKoreanCodeLookup.test.ts`

Expected: 현재 조회 URL에 locale이 없고 한국어 전용 lookup이 없어 실패한다.

- [ ] **Step 3: 공통 파사드를 구현한다**

표시용 공통코드는 모두 `useCodeOptions` 또는 위임 composable을 통과하게 하고 URL/query와 asyncData key에 locale을 명시한다. option selection, 저장, filter는 이름이 아니라 기존 `cdva` 등 식별값을 사용한다. Excel 반입·붙여넣기처럼 한국어 이름으로 역검색하는 코드만 `useKoreanCodeLookup`으로 교체하고 표시 결과는 다시 현재 locale option map을 사용한다.

- [ ] **Step 4: 파사드 테스트 GREEN을 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/composables/useCodeOptions.test.ts tests/unit/composables/useKoreanCodeLookup.test.ts tests/unit/composables/useBudgetPeriod.test.ts`

Expected: locale별 요청 격리와 한국어 Excel 해석 정책이 통과한다.

- [ ] **Step 5: 공통코드 파사드 slice를 커밋한다**

```powershell
git -C it_frontend add -- app/composables/useCodeOptions.ts app/composables/useBudgetPeriod.ts app/composables/useProjectCurrencies.ts app/composables/useCouncilCodes.ts app/composables/ioeCategoryHelpers.ts app/composables/useKoreanCodeLookup.ts tests/unit/composables
git -C it_frontend commit -m "feat: localize common code clients"
```

### Task 7: API 오류 코드 번역과 안전한 fallback

**Files:**
- Create: `it_frontend/app/utils/apiErrorMessage.ts`
- Modify: `it_frontend/app/composables/useApiFetch.ts`
- Modify: `it_frontend/app/plugins/auth.ts`
- Modify: `it_frontend/app/error.vue`
- Create: `it_frontend/tests/unit/utils/apiErrorMessage.test.ts`
- Modify: `it_frontend/tests/unit/composables/useApiFetch.test.ts`
- Modify: `it_frontend/tests/unit/plugins/auth.test.ts`

**Interfaces:**
- Produces: `resolveApiErrorMessage(error, locale, t): { message: string; requestId?: string }`
- Preserves: 인증 만료 redirect와 기존 status handling

- [ ] **Step 1: 알려진/미정의 오류 실패 테스트를 작성한다**

알려진 서버 `code`는 `errors.api.{code}`가 존재할 때 번역한다. 영어 화면에서 code가 없고 서버 message가 `처리 중 오류가 발생했습니다`이면 이를 노출하지 않고 `errors.generic`과 `X-Request-Id`를 표시한다. 한국어 화면은 전환 기간 호환으로 서버 message를 사용할 수 있지만 request ID를 잃지 않는다. 401/403/404/500 기본 매핑도 검증한다.

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/utils/apiErrorMessage.test.ts tests/unit/composables/useApiFetch.test.ts tests/unit/plugins/auth.test.ts`

Expected: 오류 resolver가 없고 영어 unknown 오류가 서버 한국어를 노출해 실패한다.

- [ ] **Step 3: 오류 resolver와 소비자를 구현한다**

`apiErrorMessage.ts`는 status/code/requestId 추출만 담당하고 Toast 생성은 각 소비자에 남긴다. `useApiFetch`, auth plugin, `error.vue`의 사용자 문구를 번역 키로 교체한다. 원본 server message와 stack/body는 콘솔/진단 흐름에만 남기고 영어 사용자 UI에 전달하지 않는다.

- [ ] **Step 4: 오류·회귀 테스트 GREEN을 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/utils/apiErrorMessage.test.ts tests/unit/composables/useApiFetch.test.ts tests/unit/plugins/auth.test.ts`

Expected: 알려진 오류, unknown fallback, 인증 redirect가 모두 통과한다.

- [ ] **Step 5: 오류 처리 slice를 커밋한다**

```powershell
git -C it_frontend add -- app/utils/apiErrorMessage.ts app/composables/useApiFetch.ts app/plugins/auth.ts app/error.vue tests/unit/utils/apiErrorMessage.test.ts tests/unit/composables/useApiFetch.test.ts tests/unit/plugins/auth.test.ts
git -C it_frontend commit -m "feat: localize api error messages"
```

### Task 8: OpenAPI 타입 재생성과 기반 전체 검증

**Files:**
- Modify: `it_frontend/app/types/api.d.ts`
- Modify: `it_frontend/tests/unit/i18n/messages.test.ts`

**Interfaces:**
- Verifies: 백엔드 `lang`·관리자 translations 계약과 생성 타입 일치

- [ ] **Step 1: 검증된 백엔드에서 타입을 재생성한다**

Run: 백엔드를 DB·백엔드 계획의 최종 SHA로 기동.

Run: `cd it_frontend && npm run codegen`

Expected: 메뉴/공통코드 GET의 `lang`과 관리자 번역 DTO가 `app/types/api.d.ts`에 반영된다.

- [ ] **Step 2: 생성 타입 사용처의 수동 임시 타입을 제거한다**

Task 3~7에서 임시로 선언한 API response/request 타입이 있으면 생성 타입으로 교체한다. 앱 고유 `AppLocale`과 UI-only 타입은 유지한다.

- [ ] **Step 3: 기반 품질 게이트를 실행한다**

```powershell
cd it_frontend
npm run codegen:check
npm run format:check
npm run check
npm test
```

Expected: 생성 타입 drift, formatter, ESLint/TypeScript, 전체 Vitest가 모두 통과한다.

- [ ] **Step 4: 정적 생성 smoke test를 실행한다**

Run: `cd it_frontend && npm run generate:local`

Expected: locale loader가 두 언어 리소스를 모두 번들하고 route 생성이 완료된다.

- [ ] **Step 5: 프론트 기반 최종 커밋을 만든다**

```powershell
git -C it_frontend add -- app/types/api.d.ts
git -C it_frontend diff --cached --check
git -C it_frontend commit -m "chore: sync multilingual api types"
```

Run: `git -C it_frontend rev-parse HEAD`

Expected: 화면 전환 계획이 시작할 기준 프론트 SHA를 실행 로그에 남긴다.
