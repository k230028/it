# Phase C — 프론트 오류 상태와 서버 보안 경계 (ERR-10) Implementation Plan

> **검토 반영일:** 2026-07-25
>
> **상태:** Engineering Review 반영 완료, 구현 가능
> **분할:** 통화, Tiptap, PDF, 결과 상태 동기화를 네 독립 작업선으로 실행한다.

**Goal:** 네트워크·데이터·비동기 실패를 정상 빈 상태나 성공처럼 숨기지 않고 사용자가 이해하고 복구할 수 있게 한다. 결과 상태 변경 API에는 서버 관리자 권한을 강제한다.

**Architecture:**

- 통화는 공용 `useProjectCurrencies`가 단일 조회·파싱·오류 상태를 소유한다. eager 자동 조회는 유지하되 같은 composable 인스턴스의 동시 호출은 하나의 Promise를 공유한다.
- Tiptap 단건 변수 삽입 실패만 `ERROR`로 승격하고, 읽기 전용 4개 화면이 의존하는 bulk `resolveTokens`의 `STALE` 계약은 유지한다.
- PDF는 요청 revision을 추적한다. 최신 요청만 미리보기를 갱신하며 최신 revision 생성이 완료된 경우에만 상신한다.
- 상태 동기화는 서버 `@PreAuthorize("hasRole('ADMIN')")`가 최종 경계다. 프론트는 `auth/permanent/transient` 오류를 모두 표시하고 transient만 재시도한다.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, PrimeVue, Vitest, Vue Test Utils, Playwright, Spring Boot, Spring Security, MockMvc

---

## 전체 사용자 흐름

```text
통화
  mount -> eager load
           ├─ 호출 중 load() 재호출 -> 같은 Promise await
           ├─ 최초 성공 -> READY
           ├─ 최초 실패 -> ERROR, KRW only, retry
           ├─ 성공 뒤 재조회 실패 -> STALE, last-known-good 유지, retry
           └─ malformed row -> 정상 row 유지 + INCOMPLETE warning

Tiptap
  변수 삽입 -> resolveInsertedToken
              ├─ success -> RESOLVED
              └─ failure -> ERROR chip + message + retry
                            ├─ success -> RESOLVED
                            └─ failure -> ERROR 유지

PDF
  결재선 변경 -> currentRevision++
                 -> generate(revision)
                    ├─ revision != currentRevision -> 결과 폐기
                    ├─ 최신 성공 -> completedRevision=revision
                    └─ 최신 실패/빈 URL -> 오류 + URL 무효화
  상신 -> !generating && completedRevision==currentRevision && valid URL

상태 동기화
  전원 검토 완료 -> POST /result/review/sync [ADMIN]
                   ├─ 200 true/false -> 정상
                   ├─ 401/403 -> AUTH, 표시, 재시도 없음
                   ├─ other 4xx -> PERMANENT, 표시, 재시도 없음
                   └─ network/5xx -> TRANSIENT, 표시 + 제한 toast + retry
```

---

## What already exists

- `useProjectCurrencies`와 `parseCurrencyRate`/날짜 파서가 존재한다. 새 통화 service나 store를 만들지 않고 확장한다.
- `cost/form.vue`는 `cdva`를 통화코드, `cdvaDtl`을 환율 기준일로 올바르게 사용한다. 이 계약을 공용 composable로 옮긴다.
- Tiptap metadata의 `error`, VariableNode 상태 렌더링, stale 응답 무시 로직이 존재한다.
- `formatApiError`, `TOAST_LIFE`, `$apiFetch`, PrimeVue `Message`/`Toast`를 재사용한다.
- `projects/report.vue`의 PDF renderer와 URL revoke 경로를 재사용한다.
- `ResultService.syncReviewStatus`는 이미 진행 상태가 10이 아니면 HTTP 200 `false`를 반환한다. “이미 전이됨”을 4xx로 추정하지 않는다.

## NOT in scope

- 전역 통화 store/cache: 현재 소비자 수에는 인스턴스 single-flight와 last-known-good가 충분하다.
- Tiptap 읽기 전용 `resolveTokens`의 `STALE` 계약 변경: 기존 4개 화면 회귀 위험이 크다.
- PDF renderer 취소 프로토콜 도입: revision으로 stale 결과를 무시하며 실제 취소는 renderer가 AbortSignal을 지원할 때 별도 최적화한다.
- 협의회 전체 권한 모델 재설계: 이번에는 상태 동기화 endpoint의 관리자 경계만 닫는다.
- 전역 프론트 오류 프레임워크: 네 흐름의 명시적 상태를 각 composable/component에 둔다.
- 화면 시각 디자인 재설계: 기존 PrimeVue 패턴과 토큰을 유지한다.

---

## File Structure

```text
it_frontend/
  app/
    composables/useProjectCurrencies.ts
    pages/info/cost/form.vue
    components/cost/TerminalFormDialog.vue
    composables/useTiptapVariables.ts
    components/common/tiptap/
      VariableNodeView.vue
      TiptapEditor.vue
    pages/info/projects/report.vue
    utils/reportPdfState.ts                         # 신규
    components/council/result/ResultReviewProgress.vue
    utils/statusSyncError.ts                        # 신규
  tests/
    unit/composables/useProjectCurrencies.test.ts
    unit/components/CurrencyErrorStates.test.ts
    unit/composables/useTiptapVariables.test.ts
    unit/components/VariableNodeView.test.ts
    unit/components/TiptapEditor.test.ts
    unit/utils/reportPdfState.test.ts
    unit/pages/infoProjectsReport.test.ts
    unit/utils/statusSyncError.test.ts
    unit/components/ResultReviewProgress.test.ts
    e2e/error-recovery-currency.spec.ts
    e2e/error-recovery-tiptap.spec.ts
    e2e/report-pdf-latest.spec.ts
    e2e/result-review-sync.spec.ts

it_backend/
  src/main/java/com/kdb/it/domain/council/controller/CouncilController.java
  src/test/java/com/kdb/it/domain/council/controller/CouncilControllerSecurityTest.java
```

---

## Lane C1 — 통화 단일 조회와 복구 가능한 상태

### Task C1-1 — `useProjectCurrencies`를 단일 진실 공급원으로 만든다

**상태 계약**

```ts
type CurrencyLoadState = 'LOADING' | 'READY' | 'INCOMPLETE' | 'STALE' | 'ERROR';
```

| 상황 | 상태 | 데이터 |
|---|---|---|
| 최초 호출 중 | `LOADING` | KRW 기본값 |
| 전체 성공 | `READY` | 새 options/rates/auto-fill |
| 일부 row 손상 | `INCOMPLETE` | 유효 row만 반영 |
| 이전 성공 후 재조회 실패 | `STALE` | last-known-good 유지 |
| 성공 이력 없는 조회 실패 | `ERROR` | KRW, 빈 map |

**RED**

- composable 생성 직후 eager 요청이 한 번 시작된다.
- eager 요청 중 명시적 `loadProjectCurrencies()`는 같은 Promise를 반환하고 API는 한 번만 호출된다.
- 완료 후 다시 호출하면 새 요청이 시작된다.
- 실패 후 다시 호출하면 재시도할 수 있다.
- `cdva`가 blank인 row는 통화코드로 사용하지 않고 `INCOMPLETE`로 표시한다.
- `cdvaDtl`은 오직 환율 기준일로 사용하며 통화코드 폴백이 아니다.
- 중복 `cdva`는 첫 번째 유효 row를 유지하고 `INCOMPLETE`로 표시한다.
- rate의 콤마·blank·불량 값과 날짜 파싱을 모두 검증한다.
- 초기 실패는 KRW만 유지한다.
- 성공 뒤 실패는 세 산출물 `currencyOptions`, `previewRates`, `currencyAutoFillMap`을 모두 last-known-good로 유지한다.

**GREEN**

1. module-global cache가 아닌 composable 인스턴스 내부 `let inFlight: Promise<void> | null`을 둔다.
2. `loadProjectCurrencies()`는 in-flight가 있으면 그대로 await/return한다.
3. 실제 로드는 임시 local 객체에 완성한 뒤 세 산출물을 한 번에 교체한다. 중간 상태 노출을 금지한다.
4. `.finally(() => inFlight = null)`로 성공·실패 뒤 재시도를 허용한다.
5. `const code = currency.cdva?.trim()`만 허용한다.
6. malformed/duplicate row는 정화된 진단 로그와 사용자용 warning 상태를 남긴다.
7. 사용자 메시지는 다음을 구분한다.
   - INCOMPLETE: “일부 통화 정보를 제외했습니다.”
   - STALE: “최신 통화 정보를 불러오지 못해 이전 값을 표시합니다.”
   - ERROR: “통화 정보를 불러오지 못했습니다. 원화만 사용할 수 있습니다.”

**검증 및 커밋**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/composables/useProjectCurrencies.test.ts
npm run typecheck
git add app/composables/useProjectCurrencies.ts `
        tests/unit/composables/useProjectCurrencies.test.ts
git commit -m "fix: 통화 조회 single-flight와 last-known-good 상태 도입 (ERR-10)"
```

### Task C1-2 — 두 소비자를 공용 계약으로 이관한다

**Files**

- Modify: `app/pages/info/cost/form.vue`
- Modify: `app/components/cost/TerminalFormDialog.vue`
- Create: `tests/unit/components/CurrencyErrorStates.test.ts`
- Create: `tests/e2e/error-recovery-currency.spec.ts`

**필수 테스트**

- cost form과 Terminal dialog가 인라인 fetch·독자 파서를 사용하지 않는다.
- 두 화면 모두 ERROR/STALE/INCOMPLETE 메시지와 “다시 시도”를 렌더링한다.
- 재시도 중 버튼 disabled/loading이 보이고 빠른 연속 클릭이 API 중복 호출을 만들지 않는다.
- STALE 상태에서도 기존 옵션과 자동입력 값을 유지한다.
- Playwright에서 최초 실패→재시도 성공, 성공→재조회 실패의 사용자 흐름을 검증한다.

**커밋**

```powershell
git add app/pages/info/cost/form.vue `
        app/components/cost/TerminalFormDialog.vue `
        tests/unit/components/CurrencyErrorStates.test.ts `
        tests/e2e/error-recovery-currency.spec.ts
git commit -m "refactor: 통화 소비 화면의 오류·재시도 상태 통합 (ERR-10)"
```

---

## Lane C2 — Tiptap 단건 해석 ERROR와 재시도

### Task C2-1 — 단건 삽입 실패만 `ERROR`로 승격한다

**Files**

- Modify: `app/composables/useTiptapVariables.ts`
- Modify: `app/components/common/tiptap/VariableNodeView.vue`
- Modify: matching unit tests

**RED**

- `resolveInsertedToken` 실패는 최신 요청일 때만 `ERROR`로 반영한다.
- 이전 요청이 늦게 실패/성공해도 최신 metadata를 덮어쓰지 않는다.
- `resolveTokens` bulk 실패는 기존 `STALE` 계약을 유지한다.
- ERROR chip은 성공·STALE과 시각·접근성 텍스트가 구분된다.

**GREEN**

- metadata union에 `ERROR`를 추가한다.
- 단건 경로에서만 network/API 실패를 `ERROR`로 변환한다.
- 기존 request sequence/stale response guard를 유지한다.
- `VariableNodeView`에 `aria-label`과 ERROR 스타일을 추가한다.

### Task C2-2 — 에디터 메시지와 재시도를 컴포넌트 테스트로 고정한다

**Files**

- Modify: `app/components/common/tiptap/TiptapEditor.vue`
- Create/Modify: `tests/unit/components/TiptapEditor.test.ts`
- Create: `tests/e2e/error-recovery-tiptap.spec.ts`

**필수 테스트**

- ERROR 노드가 있으면 인라인 메시지와 재시도 버튼이 보인다.
- 재시도 성공 시 ERROR가 사라지고 최신 값이 보인다.
- 재시도 실패 시 ERROR와 메시지가 유지된다.
- 컴포넌트 unmount 뒤 완료한 요청이 상태를 갱신하지 않는다.
- Playwright에서 변수 삽입 실패→재시도 성공을 검증한다.

수동 QA만으로 이 경로를 종료하지 않는다. `useEditor` 하네스가 취약하면 editor 생성 adapter를 테스트 seam으로 분리하되 제품 코드에 범용 추상화는 추가하지 않는다.

**검증 및 커밋**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/composables/useTiptapVariables.test.ts `
                  tests/unit/components/VariableNodeView.test.ts `
                  tests/unit/components/TiptapEditor.test.ts
npx playwright test tests/e2e/error-recovery-tiptap.spec.ts
git add app/composables/useTiptapVariables.ts `
        app/components/common/tiptap/VariableNodeView.vue `
        app/components/common/tiptap/TiptapEditor.vue `
        tests/unit/composables/useTiptapVariables.test.ts `
        tests/unit/components/VariableNodeView.test.ts `
        tests/unit/components/TiptapEditor.test.ts `
        tests/e2e/error-recovery-tiptap.spec.ts
git commit -m "fix: Tiptap 단건 해석 ERROR와 복구 흐름 구현 (ERR-10)"
```

---

## Lane C3 — 최신 PDF만 상신 가능한 revision 상태

### Task C3-1 — PDF 상태 머신을 순수 유틸로 고정한다

**Files**

- Create: `app/utils/reportPdfState.ts`
- Create: `tests/unit/utils/reportPdfState.test.ts`

**상태**

```ts
interface ReportPdfState {
    currentRevision: number;
    completedRevision: number | null;
    generating: boolean;
    pdfUrl: string | null;
    error: string;
}
```

**RED**

- 새 생성 시작은 `currentRevision`을 증가시키고 `generating=true`로 만든다.
- 최신 성공만 URL과 `completedRevision`을 갱신한다.
- 이전 revision의 늦은 성공·실패는 상태를 바꾸지 않는다.
- 최신 빈 URL과 throw는 기존 URL을 revoke·무효화하고 오류를 설정한다.
- 새 생성 중에는 이전 URL이 있어도 상신할 수 없다.
- `completedRevision !== currentRevision`이면 상신할 수 없다.
- 최신 실패 뒤 재시도 성공은 다시 상신 가능하다.

`isPdfReadyForSubmit`은 다음 조건을 모두 요구한다.

```text
!generating
&& error is blank
&& pdfUrl is valid
&& completedRevision === currentRevision
```

### Task C3-2 — report 페이지와 사용자 흐름을 연결한다

**Files**

- Modify: `app/pages/info/projects/report.vue`
- Create/Modify: `tests/unit/pages/infoProjectsReport.test.ts`
- Create: `tests/e2e/report-pdf-latest.spec.ts`

**필수 구현**

- 결재자 변경 watcher는 `void generatePdf()`로 호출하더라도 내부 revision이 순서를 보장한다.
- 최신 요청만 이전 URL을 revoke하고 새 URL을 설정한다.
- 페이지 unmount 시 현재 URL을 revoke한다.
- 생성 중·stale·오류 상태에서 상신 버튼을 disabled하고 이유를 인라인 표시한다.
- submit 직전에도 `isPdfReadyForSubmit`을 다시 검사한다.

**Playwright**

- 첫 요청을 지연시키고 두 번째 요청을 먼저 완료시켜 두 번째 미리보기만 보이는지 확인한다.
- 생성 중 상신이 차단되는지 확인한다.
- 최신 요청 실패→재시도 성공 뒤 상신 가능한지 확인한다.

**검증 및 커밋**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/utils/reportPdfState.test.ts `
                  tests/unit/pages/infoProjectsReport.test.ts
npx playwright test tests/e2e/report-pdf-latest.spec.ts
git add app/utils/reportPdfState.ts `
        app/pages/info/projects/report.vue `
        tests/unit/utils/reportPdfState.test.ts `
        tests/unit/pages/infoProjectsReport.test.ts `
        tests/e2e/report-pdf-latest.spec.ts
git commit -m "fix: 최신 revision PDF만 미리보기·상신 허용 (ERR-10)"
```

---

## Lane C4 — 결과 상태 동기화 보안과 오류 분류

### Task C4-1 — 서버 관리자 경계를 추가한다

**Files**

- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/controller/CouncilController.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/council/controller/CouncilControllerSecurityTest.java`

**RED**

- ADMIN JWT/인증으로 POST `/api/councils/{asctId}/result/review/sync` 호출 시 200과 boolean body를 반환한다.
- 일반 사용자 인증은 403이며 `ResultService.syncReviewStatus`를 호출하지 않는다.
- 비인증 요청은 프로젝트 보안 계약에 따른 401/403이며 service를 호출하지 않는다.
- 이미 11/12/13 등 상태인 경우 service의 기존 200 `false` 계약을 유지한다.

**GREEN**

```java
@PreAuthorize("hasRole('ADMIN')")
@PostMapping("/{asctId}/result/review/sync")
public ResponseEntity<Boolean> syncReviewStatus(...) { ... }
```

메서드 수준으로 적용해 같은 `CouncilController`의 일반 사용자 endpoint까지 관리자 전용으로 바꾸지 않는다.

**검증 및 커밋**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.domain.council.controller.CouncilControllerSecurityTest"
git add src/main/java/com/kdb/it/domain/council/controller/CouncilController.java `
        src/test/java/com/kdb/it/domain/council/controller/CouncilControllerSecurityTest.java
git commit -m "fix: 결과 검토 상태 동기화 API 관리자 권한 강제"
```

### Task C4-2 — `auth/permanent/transient`를 모두 표시한다

**Files**

- Create: `it_frontend/app/utils/statusSyncError.ts`
- Modify: `it_frontend/app/components/council/result/ResultReviewProgress.vue`
- Create unit/component/E2E tests

**분류 계약**

| 오류 | 분류 | 화면 | 재시도 |
|---|---|---|---|
| 401/403 | `auth` | 권한/세션 메시지 | 없음 |
| 기타 4xx | `permanent` | 요청 처리 불가 메시지 | 없음 |
| network/timeout/5xx | `transient` | 일시 오류 메시지 + 제한 toast | 명시적 버튼 |

**RED**

- 200 true는 `statusAdvanced`를 한 번 emit한다.
- 200 false는 오류가 아니며 배너를 표시하지 않는다.
- 401/403을 조용히 억제하지 않는다.
- 409 등 permanent 오류를 “이미 전이됨”으로 추정하지 않는다.
- transient 실패만 `syncTriggered=false`로 되돌리고 재시도를 허용한다.
- transient toast는 분당 한 번이지만 인라인 배너는 계속 보인다.
- 빠른 watcher 재실행과 retry 클릭이 동시에 두 요청을 만들지 않는다.
- prop/asctId 변경 시 이전 오류·in-flight 결과가 새 협의회 상태를 덮어쓰지 않는다.
- Playwright는 관리자 transient→retry 성공과 일반 사용자 403 표시를 검증한다.

**GREEN**

- `classifyStatusSyncError`는 상태 코드 추출을 한 곳에서 수행한다.
- 컴포넌트의 `runSync`는 `inFlight` single-flight를 가진다.
- auth/permanent 상태는 자동 재시도하지 않는다.
- transient만 명시적 재시도 버튼을 보인다.
- 모든 오류는 `formatApiError` 기반의 사용자 메시지와 진단 로그를 남긴다.

**검증 및 커밋**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/utils/statusSyncError.test.ts `
                  tests/unit/components/ResultReviewProgress.test.ts
npx playwright test tests/e2e/result-review-sync.spec.ts
git add app/utils/statusSyncError.ts `
        app/components/council/result/ResultReviewProgress.vue `
        tests/unit/utils/statusSyncError.test.ts `
        tests/unit/components/ResultReviewProgress.test.ts `
        tests/e2e/result-review-sync.spec.ts
git commit -m "fix: 결과 상태 동기화 오류 분류와 복구 UI 구현 (ERR-10)"
```

---

## 최종 게이트

```powershell
cd C:\it\it_backend
.\gradlew test
.\gradlew spotlessCheck

cd C:\it\it_frontend
npm run typecheck
npm run lint
npm test -- --run
npx playwright test tests/e2e/error-recovery-currency.spec.ts `
                    tests/e2e/error-recovery-tiptap.spec.ts `
                    tests/e2e/report-pdf-latest.spec.ts `
                    tests/e2e/result-review-sync.spec.ts
```

**완료 조건**

- [ ] 통화 eager+명시 호출이 하나의 API 요청을 공유한다.
- [ ] `cdvaDtl`이 통화코드로 사용되는 경로가 없다.
- [ ] 통화 초기 오류와 stale last-known-good가 구분된다.
- [ ] Tiptap 단건 ERROR가 재시도 성공/실패와 stale 응답 역전을 처리한다.
- [ ] 최신 PDF revision만 화면과 상신에 사용된다.
- [ ] 생성 중·실패·stale PDF는 상신할 수 없다.
- [ ] 상태 동기화 API가 서버에서 ADMIN만 허용한다.
- [ ] 401/403·기타 4xx·5xx/network가 모두 올바르게 표시된다.
- [ ] 핵심 사용자 흐름 네 개에 Playwright가 존재한다.
- [ ] 모든 신규 파일 커밋이 명시적 `git add`를 사용한다.
- [ ] ERR-10을 구현·테스트 근거와 함께 `TASK_DONE.md`로 이관한다.

---

## 실패 모드와 관측 계약

| 코드 경로 | 운영 실패 | 테스트 | 처리 | 사용자 결과 |
|---|---|---|---|---|
| 통화 eager+명시 load | 중복·순서 역전 | composable unit | single-flight | 한 번 로드 |
| 통화 재조회 | 성공 데이터가 실패로 사라짐 | unit+E2E | last-known-good | stale 경고+기존 값 |
| 통화 row | 날짜가 통화코드가 됨 | unit | `cdva` 필수 | 일부 제외 경고 |
| Tiptap retry | 이전 요청이 최신 값을 덮음 | unit+component | sequence guard | 최신 결과 유지 |
| PDF 생성 | 느린 이전 요청이 최신 PDF 덮음 | state unit+E2E | revision guard | 최신 미리보기 |
| PDF 상신 | 생성 중 이전 PDF 상신 | component+E2E | submit guard | 버튼 차단+이유 |
| 상태 sync 권한 | 일반 사용자가 상태 변경 | MockMvc security | `@PreAuthorize` | 403 |
| 상태 sync 403 | 4xx 억제로 사용자 무지 | component+E2E | auth 표시 | 권한 메시지 |
| 상태 sync 5xx | watcher만 기다려 복구 불가 | component+E2E | retry | 일시 오류+재시도 |

## 병렬 실행 전략

| Lane | Modules touched | Depends on |
|---|---|---|
| C1 통화 | frontend composables, cost page/components | — |
| C2 Tiptap | frontend tiptap composable/components | — |
| C3 PDF | frontend report page/utils | — |
| C4 상태 sync | backend council controller, frontend council result | — |
| Final docs | root docs | C1, C2, C3, C4 |

- C1/C2/C3/C4는 별도 worktree에서 병렬 실행할 수 있다.
- C4는 backend와 frontend에 각각 커밋한다. 중첩 저장소를 한 커밋으로 묶지 않는다.
- 공통 `it_frontend/CLAUDE.md`, lockfile, `TASK.md`는 각 lane에서 수정하지 않는다.
- 모든 lane을 병합한 뒤 최종 게이트와 완료 문서 이관을 한 번 수행한다.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | STALE | 이전 리뷰 이후 39 commits, 현재 계획에는 미적용 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 통화 single-flight·Tiptap 컴포넌트 테스트·PDF revision·서버 인가 보완 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — 구현 가능
