# 프론트엔드 에러 처리 보강 (미조치 5건) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** TASK.md 에러 처리 프론트 항목 중 현행 코드에서 실제 미조치인 5건(F1~F5)을 §4.2.1 패턴으로 보강한다.

**Architecture:** 대부분 catch 블록에 `toast`(또는 `console.warn`) 추가. F4는 인라인 오류 상태(`searchError` ref) + 소비 컴포넌트(GlobalSearchBar) 빈 상태 분기. 페이지/컴포넌트 toast는 단위 테스트 가치가 낮아 typecheck/lint로 회귀 방지하고, F4 composable만 단위 테스트.

**Tech Stack:** Nuxt 4 / TypeScript / PrimeVue Toast / Vitest. 작업 저장소: `it_frontend`(별도 git repo).

> **Spec:** `docs/superpowers/specs/2026-06-24-frontend-error-handling-design.md`
> ⚠️ `it_frontend`는 별도 git repo. 커밋은 `git -C it_frontend ...`. 작업 전 `git -C it_frontend branch --show-current` 확인.
> ℹ️ 현행 확인(2026-06-24)에서 12건 중 7건은 이미 조치됨 → 본 plan은 미조치 5건만. stale 7건은 Task 7에서 `TASK_DONE.md`로 정리.

---

## Task 1: F1 🔴 projects/form.vue 편집 로드 실패 리다이렉트

**Files:** Modify `it_frontend/app/pages/info/projects/form.vue` (현재 catch ~710-713)

현재 코드:
```ts
} catch (e) {
    // FIXME: [F-C-02] 수정 모드 데이터 로드 실패 시 toast 표시 후 목록 페이지로 강제 이동 필요 — 빈 폼 착오저장 위험
    console.error(e);
}
```

- [ ] **Step 1: catch 교체** (해당 catch 블록을 찾아 교체. `router`/`toast`는 이미 파일에 존재 — line 70 `const toast`, line 706 `router.push('/info/projects')` 참고)
```ts
} catch (e) {
    console.error('[Project] 편집 데이터 로드 실패:', e);
    toast.add({
        severity: 'error',
        summary: '데이터 로드 실패',
        detail: '프로젝트 정보를 불러오지 못했습니다. 목록으로 이동합니다.',
        life: 3000,
    });
    router.push('/info/projects');
}
```
> 먼저 그 catch가 편집 모드(id 기반) 데이터 로드 경로인지 위쪽 try를 읽어 확인. `router`가 `useRouter()`로 선언됐는지 확인(line 706에서 사용 중이므로 존재).

- [ ] **Step 2: typecheck**

Run: `cd it_frontend && npm run typecheck 2>&1 | tail -8`
Expected: 신규 오류 없음.

- [ ] **Step 3: 커밋**
```bash
git -C it_frontend add app/pages/info/projects/form.vue && git -C it_frontend commit -m "fix: 프로젝트 편집 로드 실패 시 toast + 목록 리다이렉트(빈 폼 덮어쓰기 방지)"
```

---

## Task 2: F2 🟠 review.vue 자동저장 실패 알림

**Files:** Modify `it_frontend/app/pages/info/documents/[id]/review.vue` (현재 catch ~179-182)

현재 코드:
```ts
} catch {
    // FIXME: 자동 저장 실패 완전 삼킴 — 사용자가 저장됐다고 오인할 수 있음. console.warn + toast 경고 추가 필요
    // 저장 실패 시 코멘트 기능을 막지 않음 (재시도 없이 무시)
}
```

- [ ] **Step 1: catch 교체** (`toast`는 이미 line 18 `const toast = useToast();`로 존재). 자동 재시도는 도입하지 않음(YAGNI):
```ts
} catch (e) {
    console.warn('[Review] 자동 저장 실패:', e);
    toast.add({
        severity: 'warn',
        summary: '자동 저장 실패',
        detail: '변경 내용이 저장되지 않았습니다. 잠시 후 다시 시도해 주세요.',
        life: 3000,
    });
}
```

- [ ] **Step 2: typecheck**

Run: `cd it_frontend && npm run typecheck 2>&1 | tail -8`
Expected: 신규 오류 없음.

- [ ] **Step 3: 커밋**
```bash
git -C it_frontend add "app/pages/info/documents/[id]/review.vue" && git -C it_frontend commit -m "fix: 사전협의 자동 저장 실패 시 warn 로그 + toast 경고"
```

---

## Task 3: F3 🟠 ExcalidrawWrapper.vue 3개 실패 경로 알림

**Files:** Modify `it_frontend/app/components/ExcalidrawWrapper.vue` (catch ~85-89 export, ~153-156 init, ~194-197 장면복원)

이 파일은 `useToast` 미import. `<script setup>` 상단 import 추가 + `const toast = useToast();` 선언.

- [ ] **Step 1: import + 인스턴스 추가**
파일 상단 import 영역에 `import { useToast } from 'primevue/usetoast';` 추가, setup 본문 상단(다른 const 옆)에 `const toast = useToast();` 추가.

- [ ] **Step 2: exportData catch(~85-89) 보강** (기존 `console.error` + `return null` 유지, toast 추가)
```ts
} catch (error) {
    console.error('[ExcalidrawWrapper] 내보내기 실패:', error);
    toast.add({ severity: 'error', summary: '내보내기 실패', detail: '다이어그램을 저장하지 못했습니다.', life: 3000 });
    return null;
}
```

- [ ] **Step 3: onMounted 초기화 catch(~153-156) 보강**
```ts
} catch (error) {
    console.error('[ExcalidrawWrapper] Excalidraw 초기화 실패:', error);
    toast.add({ severity: 'error', summary: '에디터 로드 실패', detail: '다이어그램 편집기를 불러오지 못했습니다.', life: 3000 });
}
```

- [ ] **Step 4: watch 장면복원 catch(~194-197) 보강**
```ts
} catch (e) {
    console.error('[ExcalidrawWrapper] 장면 데이터 로드 실패:', e);
    toast.add({ severity: 'error', summary: '장면 복원 실패', detail: '저장된 다이어그램을 불러오지 못했습니다.', life: 3000 });
}
```

- [ ] **Step 5: typecheck**

Run: `cd it_frontend && npm run typecheck 2>&1 | tail -8`
Expected: 신규 오류 없음.

- [ ] **Step 6: 커밋**
```bash
git -C it_frontend add app/components/ExcalidrawWrapper.vue && git -C it_frontend commit -m "fix: Excalidraw 내보내기/초기화/장면복원 실패 시 toast 알림"
```

---

## Task 4: F4 🟠 useGlobalSearch 인라인 오류 상태 + GlobalSearchBar 표시

**Files:**
- Modify `it_frontend/app/composables/useGlobalSearch.ts` (catch ~84-89, 반환 객체)
- Modify `it_frontend/app/components/GlobalSearchBar.vue` (빈 상태 표시)
- Test `it_frontend/tests/unit/composables/useGlobalSearch.test.ts` (없으면 생성)

현재 catch:
```ts
} catch (e) {
    // FIXME: 통합검색 데이터 로딩 실패를 빈 검색 결과로 오인하지 않도록 검색 실패 상태와 사용자 알림을 분리한다.
    console.error('[GlobalSearch] 통합검색 데이터 로딩 실패', e);
    suggestions.value = [];
    return;
}
```

- [ ] **Step 1: composable 단위 테스트 작성**
`useGlobalSearch.ts`를 먼저 읽어 export 구조(반환 객체, `searchByName` 시그니처, `$apiFetch`/`useApiFetch` 사용 방식, `suggestions` ref)를 파악한 뒤, 그 구조에 맞춰 테스트를 작성한다. 골격(실제 harness에 맞춰 조정 — `vi.stubGlobal('$fetch', ...)` 또는 `vi.mock('#app')` 등 기존 composable 테스트 패턴 따름):
```ts
it('검색 실패 시 searchError=true, suggestions=[]', async () => {
    // $apiFetch/loadAll이 reject 하도록 mock
    // searchByName 호출 후:
    expect(searchError.value).toBe(true);
    expect(suggestions.value).toEqual([]);
});
it('검색 성공 시 searchError=false', async () => {
    // 정상 응답 mock → searchByName → expect(searchError.value).toBe(false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_frontend && npm test -- useGlobalSearch 2>&1 | tail -20`
Expected: FAIL(`searchError` 미정의).

- [ ] **Step 3: composable 수정**
- `const searchError = ref(false);` 선언.
- `searchByName`(또는 검색 진입부) 성공 흐름 시작 시 `searchError.value = false;`.
- catch:
```ts
} catch (e) {
    console.warn('[GlobalSearch] 통합검색 데이터 로딩 실패', e);
    searchError.value = true;
    suggestions.value = [];
    return;
}
```
- 반환 객체에 `searchError` 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_frontend && npm test -- useGlobalSearch 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 5: GlobalSearchBar.vue 표시 분기**
`GlobalSearchBar.vue`에서 `const { ..., searchError } = useGlobalSearch();`로 받아, 결과 드롭다운의 빈 상태(현재 "결과 없음" 표시 위치)에 분기 추가: `searchError`이면 "검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." 표시, 아니면 기존 빈 결과 문구. 먼저 GlobalSearchBar.vue를 읽어 기존 빈 상태/결과 렌더 위치를 찾아 최소 침습으로 추가.

- [ ] **Step 6: typecheck + 단위**

Run: `cd it_frontend && npm run typecheck 2>&1 | tail -8 && npm test -- useGlobalSearch 2>&1 | tail -10`
Expected: 신규 타입오류 없음, 단위 PASS.

- [ ] **Step 7: 커밋**
```bash
git -C it_frontend add app/composables/useGlobalSearch.ts app/components/GlobalSearchBar.vue tests/unit/composables/useGlobalSearch.test.ts && git -C it_frontend commit -m "fix: 통합검색 실패를 빈 결과와 구분(searchError 인라인 표시)"
```

---

## Task 5: F5 🟠 ResultReviewProgress.vue 추적 로그 추가

**Files:** Modify `it_frontend/app/components/council/result/ResultReviewProgress.vue` (catch ~58-61)

현재:
```ts
} catch {
    /* 상태 전이 실패는 사용자에게 노출하지 않음 (이미 11/12/13이거나 권한 등) */
    // FIXME: 실패를 완전히 삼키고 있어 장애 추적 불가 — console.warn(e)로 기록 추가 필요 (toast 억제는 유지)
}
```

- [ ] **Step 1: catch 교체** (toast 억제 유지, 로그만 추가)
```ts
} catch (e) {
    // 상태 전이 실패는 사용자에게 노출하지 않음(이미 11/12/13이거나 권한 등) — toast 억제 유지.
    console.warn('[ResultReviewProgress] 상태 전이 실패:', e);
}
```

- [ ] **Step 2: typecheck**

Run: `cd it_frontend && npm run typecheck 2>&1 | tail -8`
Expected: 신규 오류 없음.

- [ ] **Step 3: 커밋**
```bash
git -C it_frontend add app/components/council/result/ResultReviewProgress.vue && git -C it_frontend commit -m "fix: 협의회 결과 상태전이 실패 console.warn 기록 추가(toast 억제 유지)"
```

---

## Task 6: 전체 검증

- [ ] **Step 1: 정적 점검 + 단위**

Run: `cd it_frontend && npm run check 2>&1 | tail -20 && npm test 2>&1 | tail -15`
Expected: typecheck 오류 0, lint 본 변경분 오류 0(기존 무관 경고는 구분), 단위 PASS(기존 무관 실패 — useCouncilCodes 등 — 는 구분해 보고).

> 기존에 알려진 무관 실패(`useCouncilCodes.test.ts` 8건)는 본 변경과 무관. 본 작업으로 새로 깨진 것이 없는지에 집중.

---

## Task 7: TASK.md 정리 (5건 완료 + 7건 stale 이관)

- [ ] **Step 1: TASK.md 에러 처리 섹션에서 프론트 12개 행 제거**
F1~F5(완료) + 이미 조치된 7건(stale) = 해당 프론트 에러 처리 행 전부 제거. (Medium/Low 등 다른 항목은 유지)

- [ ] **Step 2: TASK_DONE.md에 이관 subsection 추가**
"⚠️ 에러 처리(프론트)" subsection 추가: F1~F5는 2026-06-24 완료, 7건은 "이전 세션 조치분 — 현행 코드 확인(2026-06-24) 후 정리"로 기록.

- [ ] **Step 3: 커밋(outer repo)**
```bash
git add TASK.md TASK_DONE.md docs/superpowers/ && git commit -m "docs: 에러 처리 프론트 5건 완료 + stale 7건 정리(TASK_DONE)"
```

---

## Self-Review

- **Spec coverage:** F1(Task1)/F2(Task2)/F3(Task3)/F4(Task4)/F5(Task5) 전부 매핑. stale 7건은 Task7 문서 정리.
- **Placeholder scan:** 각 수정 코드 완비. F4 테스트는 composable 실제 구조 확인 후 조정 지시(harness 의존).
- **Type consistency:** `searchError` ref 이름 composable↔컴포넌트↔테스트 일관. toast.add 파라미터 §4.2.1 일관.
