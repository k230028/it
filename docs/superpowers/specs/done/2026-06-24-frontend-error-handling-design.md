# 프론트엔드 에러 처리 보강 설계 (Critical+High)

> 🗓️ 작성일: 2026-06-24
> 🎯 출처: `TASK.md` §⚠️ 에러 처리 (프론트 항목)
> 📦 범위: 작성 당시 미조치 후보 5건 중 현행 재검증 결과 F1/F2/F3/F5는 조치 확인, F4(`useGlobalSearch`)만 후속 대상.

## 1. 배경 / 현행 확인 (2026-06-24)

`TASK.md` 에러 처리 프론트 항목을 현행 코드와 대조한 결과, F1/F2/F3/F5는 이미 toast 또는 warn 처리가 적용되어 있었다. 남은 핵심 후속은 F4 `useGlobalSearch`의 실패/빈 결과 상태 분리다.

**이미 조치됨(작업 불필요, stale 정리 대상):**
`approval/[apfMngNo].vue`, `board/[blbMngNo]/[nacMngNo]/index.vue`, `EmployeeSearchDialog.vue`, `useEmployeeSearch.ts`, `useCostListPage.ts`, `info/cost/form.vue`, `useTiptapImageInsertion.ts`.

**초기 미조치 후보 5건(2026-06-24 재검증 결과 포함):**

| ID | 우선순위 | 파일·위치 | 현재 | 목표 |
| --- | --- | --- | --- | --- |
| F1 | 🔴 Critical | `app/pages/info/projects/form.vue:710-713` | 편집 모드 로드 실패 catch가 `console.error`만 → 빈 폼 표시, 저장 시 기존 데이터 덮어쓰기 위험 | `toast.error` + `router.push('/info/projects')` 리다이렉트 |
| F2 | 🟠 High | `app/pages/info/documents/[id]/review.vue:179-182` | 자동저장 catch 완전 빈 블록(사용자 저장 오인) | `console.warn(e)` + `toast` 경고(저장 실패 알림) |
| F3 | 🟠 High | `app/components/ExcalidrawWrapper.vue` (catch 3곳: `85-89` export, `153-156` init, `194-197` 장면복원) | 3개 catch 모두 `console.error`만, `useToast` 미import | `useToast` 추가 + 각 실패에 `toast.error` |
| F4 | 🟠 High | `app/composables/useGlobalSearch.ts:84-89` (+ 소비처 `app/components/GlobalSearchBar.vue`) | 실패를 `suggestions.value=[]`로 둔갑(빈 결과와 구분 불가) | 인라인 오류 상태(`searchError` ref) → 드롭다운이 "검색 중 오류" 표시. toast 없음(타입어헤드 노이즈 방지) |
| F5 | 🟠 High | `app/components/council/result/ResultReviewProgress.vue:58-61` | catch 완전 삼킴(로그 0건) | `console.warn(e)` 추가. toast 억제는 **유지**(이미/권한 사유 전이실패는 정상 흐름) |

재검증 상태: F1, F2, F3, F5는 구현 확인. F4만 Open 유지.

## 2. 설계

### 표준 패턴 (§4.2.1)
```ts
const message = error?.data?.message || '작업 처리 중 오류가 발생했습니다.';
toast.add({ severity: 'error', summary: '오류', detail: message, life: 3000 });
```
- `useToast()`는 `setup()` 컨텍스트에서 호출. 미import 파일(F3)은 `import { useToast } from 'primevue/usetoast';` 추가.
- 서버 메시지가 민감정보일 수 있으면 일반 메시지로 재작성(§4.2.1).

### F1 🔴 (projects/form.vue)
편집 모드(`id` 존재) 데이터 로드 catch에서:
```ts
} catch (e) {
    console.error('[Project] 편집 데이터 로드 실패:', e);
    toast.add({ severity: 'error', summary: '데이터 로드 실패', detail: '프로젝트 정보를 불러오지 못했습니다. 목록으로 이동합니다.', life: 3000 });
    router.push('/info/projects');
}
```
`router`/`toast`는 이미 파일에 존재(line 706의 `router.push('/info/projects')`, line 70 `const toast`). 리다이렉트로 빈 폼 저장 경로를 차단한다.

### F2 🟠 (review.vue 자동저장)
빈 catch를 다음으로 교체. 복잡한 자동 재시도는 도입하지 않는다(YAGNI) — 실패를 사용자에게 알리고 수동 재시도/계속 편집을 허용:
```ts
} catch (e) {
    console.warn('[Review] 자동 저장 실패:', e);
    toast.add({ severity: 'warn', summary: '자동 저장 실패', detail: '변경 내용이 저장되지 않았습니다. 잠시 후 다시 시도해 주세요.', life: 3000 });
}
```

### F3 🟠 (ExcalidrawWrapper.vue)
`useToast` import + `const toast = useToast();` 추가. 세 catch:
- `exportData()`(85-89): `console.error` 유지 + `toast.add({severity:'error', summary:'내보내기 실패', detail:'다이어그램을 저장하지 못했습니다.', life:3000})` 후 기존 `return null` 유지.
- `onMounted()` 초기화(153-156): `toast.add({severity:'error', summary:'에디터 로드 실패', detail:'다이어그램 편집기를 불러오지 못했습니다.', life:3000})`.
- watch 장면복원(194-197): `toast.add({severity:'error', summary:'장면 복원 실패', detail:'저장된 다이어그램을 불러오지 못했습니다.', life:3000})`.

### F4 🟠 (useGlobalSearch.ts + GlobalSearchBar.vue)
인라인 오류 상태:
- `useGlobalSearch.ts`: `const searchError = ref(false);`를 반환에 추가. `searchByName` 성공 시작 시 `searchError.value = false`, catch에서 `console.warn` + `searchError.value = true` + `suggestions.value = []`.
- `GlobalSearchBar.vue`: `searchError`를 구조분해해 드롭다운 빈 상태 영역에서 `searchError`이면 "검색 중 오류가 발생했습니다" 문구를, 아니면 기존 "결과 없음"을 표시.
- toast 미사용(타입어헤드 키 입력마다 토스트 노이즈 방지).

### F5 🟠 (ResultReviewProgress.vue)
toast 억제는 유지하고 추적성만 확보:
```ts
} catch (e) {
    // 상태 전이 실패는 사용자에게 노출하지 않음(이미 11/12/13이거나 권한 등) — toast 억제 유지.
    console.warn('[ResultReviewProgress] 상태 전이 실패:', e);
}
```

## 3. 테스트

- F4(`useGlobalSearch`): composable 단위 테스트 — 실패 시 `searchError=true`/`suggestions=[]`, 성공 시 `searchError=false` 검증(`tests/unit/composables/useGlobalSearch.test.ts` 신규 또는 기존 확장).
- F1~F3, F5: 페이지/컴포넌트의 catch는 toast(외부 의존)라 단위 테스트 가치가 낮음 — 변경 후 `npm run typecheck` + `npm run lint`로 회귀 방지. 가능하면 F3는 컴포넌트 toast mock 단위 테스트 1개 추가(선택).
- 전체: `npm run check`(typecheck+lint) 통과.

## 4. 범위 / 비범위

**포함:** F1~F5 (위 5개 파일 + `GlobalSearchBar.vue`).
**비범위:** 이미 조치된 7건(코드 변경 없음, `TASK_DONE.md` 정리만), 에러 처리 Medium/Low 항목, 백엔드.

## 5. 리스크

| 리스크 | 완화 |
| --- | --- |
| F1 리다이렉트가 정상 편집 진입까지 막을 위험 | catch(실제 로드 실패) 경로에만 적용. 성공 경로 불변. |
| F3 `useToast()`가 toast provider 없는 컨텍스트에서 호출 | ExcalidrawWrapper는 페이지 내 렌더 컴포넌트라 PrimeVue ToastService 전역 사용 가능. |
| F4 소비처(GlobalSearchBar) 변경이 검색 UX 회귀 | 빈 상태 분기만 추가, 정상 검색 경로 불변. typecheck/lint로 검증. |
