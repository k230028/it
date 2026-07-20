# 프론트엔드 에러 피드백 sweep 설계 (Medium/Low)

> 🗓️ 작성일: 2026-06-24
> 🎯 출처: `TASK.md` §⚠️ 에러 처리 (프론트 Medium/Low)
> 📦 범위: 현행 코드 검증 후 실제 미조치(NEEDS WORK)만. 이미 피드백 있는 다수 항목은 stale 정리.

## 1. 배경 / 현행 확인 (2026-06-24)

`TASK.md` 에러 처리 프론트 Medium/Low 항목을 현행 대조한 결과, 상당수(공통코드 toast, `review.ts` 경고리스트, `hwpx-images` 선택적 null, `usePdfReport` 폰트 경고 toast 등)는 이미 피드백이 적용되어 있었다. 본 사이클은 실제 미조치 ~13개 사이트만 처리한다.

## 2. 미조치 항목 및 수정 (NEEDS WORK)

### 그룹 A — 협의회 도메인 catch 바인딩/가드 (`prepare/[id].vue` 패턴으로 통일)
표준 추출 패턴(`prepare/[id].vue`, `EvaluationForm.vue`):
```ts
} catch (e: unknown) {
    const err = e as { data?: { message?: string }; message?: string };
    toast.add({ severity: 'error', summary: '...', detail: err?.data?.message ?? err?.message ?? '...기본문구...', life: 4000 });
}
```
- **A1** `pages/info/council-request/[id].vue` — `saveTemp`(~361-368), `saveComplete`(~398-405), `submitApproval`(~467-474): `catch` → `catch (e: unknown)` + 위 추출. 기존 summary/기본 detail 유지하되 `err.data?.message`를 우선 사용.
- **A2** `components/council/committee/CommitteeSelector.vue` — 위원 저장(~290-299), 기본위원 조회(~339-348): 동일 패턴.
- **A3** `components/council/schedule/ScheduleStatus.vue` — 일정 확정(~197): 동일 패턴.
- **A4 (가드)** `pages/info/council-request/[id].vue:188` — `const councilStatus = computed(() => councilData.value?.asctStsC ?? '01');` 가 로드 실패(null)를 DRAFT로 둔갑시켜 편집 가드를 해제한다. `?? '01'` 제거하고 `councilData.value?.asctStsC ?? null` 유지 + 편집 가능 판정(편집 가드/버튼 활성 computed)이 `councilStatus`가 DRAFT일 때만 허용하도록 보강. `prepare/[id].vue`의 null 유지 패턴 참조. **편집 가드 사용처를 먼저 추적**한 뒤 null이 "편집 불가"로 안전하게 흐르는지 확인(잘못하면 정상 편집까지 막힘 → 회귀 위험). 변경 후 해당 화면 편집 진입/저장 흐름 typecheck로 검증.

### 그룹 B — console.error만 → toast 추가 (useToast import 필요)
- **B1** `components/projects/ResourceTableSection.vue:291-300` — IOE 비목 코드 조회 실패: `import { useToast } from 'primevue/usetoast';` + `const toast = useToast();` 추가, catch에 `toast.add({severity:'error', summary:'코드 로드 실패', detail:'소요자원 옵션을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.', life:3000})`.
- **B2** `pages/info/cost/terminal/[id].vue:38-41` — 삭제 실패(FIXME): `useToast` import + 인스턴스 추가, catch에 `toast.add({severity:'error', summary:'삭제 실패', detail:'단말기 삭제 중 오류가 발생했습니다.', life:3000})`(가능하면 `err.data?.message` 추출).

### 그룹 C — 빈/silent catch → warn 로그(+ 상태)
- **C1** `composables/useTiptapTableTools.ts:680-683` — 완전 빈 catch(FIXME): `catch (e)` + `console.warn('[useTiptapTableTools] syncColumnWidths 실패:', e);`. toast 미사용(내부 동기화 실패).
- **C2** `stores/auth.ts:231-238` (it-portal-user 쿠키 파싱) + `:243-251` (localStorage.user 마이그레이션): 빈 catch → `catch (e)` + `console.warn(...)` + 손상 데이터 정리(쿠키는 만료 처리/삭제, localStorage는 이미 removeItem이나 warn 추가). 스토어라 toast 미사용(§4.8.1).
- **C3** `composables/useHwpxExport.ts:146-157` (내부 imageFetch): 실패 시 `console.warn('[HwpxExport] 이미지 fetch 실패:', src, e);` 추가(src 포함). 외부 catch toast는 이미 존재하므로 inner는 로그만.
- **C4** `composables/useCostListPage.ts:1481-1483` (applyContinuation 상세 폴백): silent → `catch (e)` + `console.warn('[CostList] 전년도 상세 조회 실패, 요약 데이터로 폴백:', e);`(degraded-state 추적). [1455-1457 자동완성 폴백은 정상 UX → 미변경]
- **C5** `components/ExcalidrawNodeView.vue:102-105` (sceneData SVG 재생성 실패): 기존 console.error 유지 + `loadError.value = true;` 추가(화면 실패 상태 표시 — TODO대로).

### 그룹 D — 일괄 업로드 실패 상세화
- **D1** `composables/useCostListPage.ts:1016-1021` (행별 catch): 실패 사유를 수집해 집계 toast detail에 노출. catch에서 `const err = e as { data?: { message?: string }; message?: string };` 추출해 `failedReasons.push(...)` 형태로 모으고, 최종 toast detail에 실패 행/사유 요약(최대 N개) 포함. 기존 `failedRows`/`failCount` 흐름 유지.

## 3. 테스트
- 그룹 대부분 UI catch(toast/warn)라 단위 테스트 가치 낮음 → `npm run check`(typecheck+lint) + 변경 파일별 기존 단위 테스트 회귀로 검증.
- **A4**(councilStatus 가드)는 동작 변경이므로 편집 가드 사용처를 추적해 typecheck로 회귀 확인. 기존 council 단위 테스트가 있으면 통과 유지.
- **D1**은 `useCostListPage` 단위 테스트가 일괄 업로드 토스트를 검증하면 함께 갱신.

## 4. 범위 / 비범위
**포함:** 위 NEEDS WORK 13개 사이트(8개 파일).
**비범위:** 이미 피드백 있는 항목(stale 정리만), 백엔드(readOnly tx/@Valid), 순수 문서(Java 헤더/AdminDto JavaDoc), 에러 처리 외 항목.

## 5. 리스크
| 리스크 | 완화 |
| --- | --- |
| A4 가드 변경이 정상 편집까지 차단 | 편집 가드 사용처 추적 후 적용, `prepare/[id].vue` 패턴 준수, typecheck 검증. |
| 스토어(C2)에서 쿠키 정리가 인증 상태에 영향 | 손상 데이터에만 정리 적용(정상 파싱 경로 불변). |
| D1 toast detail 과다 길이 | 실패 사유 요약 상한(예: 최대 5건 + "외 N건") 적용. |
