# 언어 선택기 아이콘 + Listbox 전환 설계

- 작성일: 2026-08-16
- 대상 저장소: `it_frontend`
- 대상 컴포넌트: `app/components/common/LocaleSwitcher.vue`

## 1. 배경과 목표

현재 언어 선택기는 `한국어`·`English` 두 개의 세그먼트 버튼(`role="group"` + `aria-pressed`)을
항상 펼쳐 놓는다. 헤더 우측 영역에는 통합검색·테마 토글·알림·사용자 정보가 이미 나란히 있어
텍스트 두 개가 차지하는 가로 폭이 부담이고, 다른 헤더 컨트롤이 모두 아이콘 버튼인 것과 비교해
시각적으로 어긋난다.

목표는 언어 선택기를 **Language 아이콘 버튼 하나**로 축소하고, 아이콘을 클릭하면 **Popover 안의
Listbox**에서 언어를 고르게 하는 것이다. 언어 전환 동작 자체(`setAppLocale`, 중복 클릭 가드)는
바꾸지 않는다.

## 2. 범위

### 2.1 포함

- `app/components/common/LocaleSwitcher.vue` 마크업·상태 교체
- `tests/unit/components/LocaleSwitcher.test.ts` 재작성

### 2.2 제외

- 국기 이미지, 언어 코드 뱃지, 검색 필터 (지원 로케일이 `ko`/`en` 2개뿐이라 불필요)
- i18n 메시지 추가 (기존 `common.language.*` 키를 그대로 재사용)
- 소비처 수정 — `AppHeader.vue:254`, `pages/login.vue:196`은 컴포넌트를 그대로 쓰므로 무변경
- 언어 전환 로직(`useAppLocale`, 쿠키, PrimeVue 로케일 동기화) 변경

## 3. 아이콘 선택

`@primeicons/vue` 패키지는 이 저장소에 설치되어 있지 않다. 대신 이미 의존성에 있는
`primeicons@7.0.0`의 CSS 아이콘 폰트 클래스 `pi pi-language`를 사용한다.

근거:

- `primeicons@7.0.0`의 `primeicons.css`에 `pi-language` 정의가 존재한다.
- 프로젝트 전역이 같은 방식을 쓴다 (`AppHeader.vue`의 `pi-sun`/`pi-moon`).
- 신규 의존성 추가가 없어 사내망 npm 접근 여부와 무관하게 동작한다.

## 4. 컴포넌트 설계

### 4.1 구조

```
[트리거 버튼] <i class="pi pi-language" />
     |
     | @click → popover.toggle($event)
     v
[PrimeVue Popover]
     └── [PrimeVue Listbox]  한국어 / English
              |
              | @update:model-value(value)
              v
        selectLocale(value) → setAppLocale(value) → popover.hide()
```

- `Popover`, `Listbox`는 `@primevue/nuxt-module` 자동 임포트를 사용한다. `Listbox`는 이 저장소에서
  처음 쓰는 PrimeVue 컴포넌트다.
- 트리거 버튼 스타일은 헤더 테마 토글 버튼과 맞춘다:
  `w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors`
- 옵션 목록은 `computed`로 구성한다:
  `[{ value: 'ko', label: t('common.language.korean') }, { value: 'en', label: t('common.language.english') }]`

### 4.2 상태

| 상태          | 타입                        | 역할                                        |
| ------------- | --------------------------- | ------------------------------------------- |
| `popoverRef`  | `ref<InstanceType<...>>`    | Popover `toggle()`/`hide()` 호출용          |
| `open`        | `ref<boolean>`              | 트리거의 `aria-expanded` 동기화             |
| `changing`    | `ref<boolean>`              | 기존 중복 전환 가드 (유지)                  |

`open`은 Popover의 `@show`/`@hide` 이벤트로만 갱신한다. 컴포넌트가 직접 열림 상태를 소유하면
바깥 클릭·ESC로 닫힐 때 어긋난다.

### 4.3 선택 처리

기존 `selectLocale`의 계약을 그대로 유지한다.

```
selectLocale(value):
  if (changing || locale === value) → popover.hide() 후 반환
  changing = true
  try  { await setAppLocale(value) }
  finally { changing = false; popover.hide() }
```

같은 언어를 다시 골라도 Popover는 닫는다. 열린 채 남으면 선택이 무시된 것처럼 보인다.

## 5. 접근성

기존 `role="group"` + `aria-pressed` 계약이 사라지므로 다음으로 대체한다.

| 요소       | 속성                                                             |
| ---------- | ---------------------------------------------------------------- |
| 트리거     | `type="button"`, `:aria-label="t('common.language.label')"`       |
| 트리거     | `aria-haspopup="listbox"`, `:aria-expanded="open"`                |
| 트리거     | `data-testid="locale-switcher-trigger"`, `:disabled="changing"`   |
| Listbox    | `:model-value="locale"` — 현재 언어가 선택 상태로 렌더링          |
| 옵션 슬롯  | `#option` 슬롯에서 `:data-locale="option.value"` 유지             |

`aria-label`은 `common.language.label`을 쓰므로 로케일에 따라 `언어 선택` / `Select language`로
바뀐다. `aria-selected` 처리는 PrimeVue `Listbox`가 담당한다.

## 6. 테스트

`tests/unit/components/LocaleSwitcher.test.ts`는 `[data-locale="ko"]`의 `aria-pressed`와
`[role="group"]`에 의존하므로 구조 변경과 함께 깨진다. `tests/unit/components/mfa/MfaDialog.test.ts`가
쓰는 **PrimeVue 스텁 패턴**을 따라 재작성한다.

스텁:

- `Popover` — 기본 슬롯을 항상 렌더링하고 `toggle`/`hide`를 `vi.fn()`으로 노출, `show`/`hide` emit 가능
- `Listbox` — `options`를 버튼 목록으로 렌더링하고 클릭 시 `update:modelValue` emit

검증 항목:

1. 트리거에 `pi-language` 아이콘이 있고, `locale`이 `en`으로 바뀌면 `aria-label`이 `Select language`가 된다.
2. 트리거를 클릭하면 Popover의 `toggle`이 호출된다.
3. Listbox에서 `en`을 선택하면 `setAppLocale('en')`이 정확히 1회 호출되고 `hide`가 호출된다.
4. 현재 언어와 같은 값을 선택하면 `setAppLocale`이 호출되지 않고 `hide`만 호출된다.

E2E는 이 컴포넌트의 셀렉터를 참조하는 스펙이 없어 영향이 없다.

## 7. 검증 명령

```
npm run format:check
npm run check
npm run lint:css
npx vitest run tests/unit/components/LocaleSwitcher.test.ts
```

## 8. 위험과 대응

| 위험                                                         | 대응                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `Listbox`가 이 저장소 첫 사용이라 Aura preset 스타일이 어색할 수 있음 | 구현 후 헤더·로그인 두 화면에서 실제 렌더링을 확인하고, 폭은 Popover 컨테이너에서 고정 |
| Popover가 `body`로 teleport되어 단위 테스트에서 슬롯이 안 보임 | 스텁으로 슬롯을 인라인 렌더링해 회피 (MfaDialog 테스트와 동일 전략)                      |
| 로그인 화면은 헤더와 hover 배경색 관례가 다름                  | 트리거는 중립 스타일 하나로 통일. 두 화면 모두에서 시각 확인                            |
