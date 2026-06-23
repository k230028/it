# 프론트엔드 리팩토링 설계 (Phase 0~4)

> 🗓️ 작성일: 2026-06-24
> 🎯 출처: `TASK.md` §🎨 프론트엔드 리팩토링 (27개 항목)
> 📌 범위: 순수 리팩토링 + 구조 결정. **Mock→API 연동(Phase 5)은 별도 기능 spec으로 분리.**

## 1. 배경 및 검증 결과

`TASK.md`의 프론트엔드 리팩토링 항목은 2026-05-14 ~ 2026-06-14 사이에 등록되었으며,
일부 dated 항목은 그 이후 작업으로 이미 해소된 상태였다. 계획 수립 전 실제 build 상태를
검증한 결과는 다음과 같다.

| 검증 항목 | TASK.md 기재 | 2026-06-24 실측 |
| --- | --- | --- |
| `npm run lint` | 73 errors / 137 warnings | **0 errors / 2 warnings** |
| `npm run typecheck` | 4건 실패 | **0 errors (exit 0)** |
| 협의회 결과 단일 template root | `vue/no-multiple-template-root` 실패 | typecheck green → 해소 |
| 전산업무비 prop 정합(`dfrCleCOptions`) | typecheck 실패 | green → 해소 |
| `plan/[id].vue` ExcelJS/Tiptap 타입 | typecheck 실패 | green → 해소 |
| `RichEditor.client.vue` → Tiptap 마이그레이션 | Quill 구버전 잔존 | **컴포넌트/참조 전무 → 이미 제거** |

→ **Build health(Bucket A) 5건과 RichEditor 마이그레이션(E)은 stale.** Phase 0에서 정리한다.

### 1.1 코드에 실재가 확인된 항목

- `app/pages/info/council-request/result/[id].vue:166` — `return s >= '05';` (FIXME 주석 동반)
- `app/components/AppSidebar.vue:189` — `_isGroupExpanded` 미사용 함수
- `app/pages/project/contract/index.vue:58` — `/* ── 상태 표시 ── */` 잔재 주석
- `app/pages/budget/list.vue` — import 15건, 탭 제거 후 dead code 후보
- `app/composables/useProjectOptions.ts` — `form.vue` 1곳에서만 사용
- `app/composables/useDeptFilter.ts` — **부재 확정**
- `app/composables/{useEstimates,useDeliberations,useContracts,usePayments}.ts` — `changeStatus` 4중복
- `app/pages/project/{deliberation,contract,payment}/index.vue` — selector 패턴 중복
- `app/pages/info/index.vue`, `app/pages/budget/{summary,comparison}.vue` — Mock/정적 데이터 (→ Phase 5)

## 2. 설계 원칙

- **검증 우선:** dated 항목은 코드/build로 실재를 확인한 뒤에만 작업 대상으로 삼는다.
- **위험도 오름차순 진행:** 버그 수정 → dead code → 추출/중복 제거 → 구조 결정.
- **행동 보존:** 리팩토링은 외부 동작을 바꾸지 않는다. 유일한 예외는 Phase 1(명시적 버그 수정)이며 TDD로 행동 변화를 고정한다.
- **단계 종료 게이트:** 각 Phase 종료 시 `npm run check`(typecheck + lint) 0/0, `npm test` green.
- **CLAUDE.md 규약 준수:** 공통 유틸 중복 구현 금지(§4.7.1.1), 에러 처리 규칙(§4.2.1), 스토어 에러 전파(§4.8.1).

## 3. Phase별 설계

### Phase 0 — TASK.md 현행화 (코드 변경 없음)

검증으로 stale 확인된 항목을 `TASK_DONE.md`로 이관하고 `TASK.md`에서 제거한다.

- 이관 대상: ESLint 73 errors, typecheck 4건 실패, 단일 template root, 전산업무비 prop 정합, `plan/[id].vue` 타입, RichEditor 마이그레이션.
- 이관 근거 문구: "2026-06-24 build 검증 — lint 0/2, typecheck 0, RichEditor 컴포넌트 제거 확인".
- 재확인 필요분(아래)은 실코드 확인 후 stale면 이관, 실재면 Phase 2/3로 편입:
  - cost 컴포넌트 type-only import 정리 (lint green이므로 stale 가능성 높음)
  - 위원유형 라벨 중복(D6) — `ScheduleStatus/CommitteeList/CommitteeSelector` 현 구현 재확인

**완료 기준:** `TASK.md`의 프론트엔드 섹션이 실재 항목만 남는다.

### Phase 1 — Logic 버그 수정 (B) · TDD

`reviewProgressEnabled`의 문자열 사전순 비교를 허용 상태 집합 판정으로 교체한다.

- 대상: `app/pages/info/council-request/result/[id].vue:162-166`
- 문제: `s >= '05'`는 `'SKIPPED' >= '05'`도 `true` → 생략된 협의회에서 위원 검토 패널 노출.
- 수정: 검토 진행이 허용되는 상태 코드 집합(예: `new Set(['05','06',...])`)을 `types/council.ts` 2자리 상수로 정의하고 `.has(s)`로 판정. `councilStatus !== '13'` 가드는 유지.
- 테스트(선행): `'04'`(미허용), `'05'`(허용), `'13'`(취소), `'SKIPPED'`(생략→미허용) 케이스를 단위 테스트로 고정.
- 산출물: 컴포넌트 로직 추출이 필요하면 순수 함수(`isReviewProgressEnabled(status)`)로 분리해 테스트 가능하게 만든다.

**완료 기준:** 신규 테스트 RED→GREEN, `'SKIPPED'`에서 패널 미노출.

### Phase 2 — Dead code 정리 (C) · 저위험

기계적 제거. 각 항목 후 `npm run check` 확인.

- `AppSidebar.vue:189` `_isGroupExpanded` 및 가림용 eslint-disable 지시어 제거.
- `contract/index.vue:58` 빈 `/* ── 상태 표시 ── */` 주석 제거 (파일 헤더 범례 주석 line 13은 유지).
- `budget/list.vue` 미사용 import/filter/pageSize/download 함수 정리 — 제거 전 참조 0건 grep 확인.

**완료 기준:** 제거 항목 참조 0건, `npm run check` 0/0, `npm test` green.

### Phase 3 — 중복 제거 / 추출 (D) · 중위험

호출부 동작을 보존하며 공통화한다. 추출 단위마다 커밋·테스트.

1. **위원유형 라벨 통일**(D6, Phase 0 재확인 후 실재 시): `ScheduleStatus.vue` 로컬 맵을 `useCouncilCodes().getMemberTypeLabel`로 통일, `CommitteeList/CommitteeSelector`의 1줄 래퍼 제거.
2. **`useProjectCostSelector()` 추출**(D4): `deliberation/contract/payment/index.vue`의 `selectedTgt`/`selectedProject`/`selectedCost`/`hasTarget`/`selectedCncdRfrNo`/`resetSelection` 공통 추출.
3. **`useDocumentApi(baseUrl)` 또는 `changeStatus` 공통화**(D3/D5): 4개 composable의 `changeStatus(docNo, stsTc)`가 URL만 다르므로 팩토리 또는 공유 헬퍼로 통합. 기존 4개 composable의 공개 시그니처는 유지(호출부 무수정).
4. **`useProjectOptions` 인라인 전환**(D1): `yearOptions`만 반환하는 단순 composable을 `form.vue`에 인라인하고 파일 제거.
5. **관리자 `useYnOptions` 중복 제거**: `admin/auth-grades.vue`·`admin/roles.vue`의 동일 옵션/태그 로직을 공통 composable/유틸로 통합.
6. **마이너 스타일**: `ResultForm.vue` emit/type 단순화(`ResultData` 미사용 제거, 단일 시그니처), `useTableColumnResize.ts` 숫자 파싱/배열 초기화 스타일 일관화.

**완료 기준:** 각 추출 후 호출부 동작 동일, 관련 단위 테스트 추가/갱신, `npm run check` 0/0.

### Phase 4 — 구조 결정 항목 · 권장안 제시

각 항목에 대해 아래 권장안을 spec에 명시하고, 실행 계획(writing-plans) 단계에서 최종 확정한다.

| 항목 | 권장안 | 근거 |
| --- | --- | --- |
| `useDeptFilter` 구현 vs 폐기 | **규칙 폐기** + CLAUDE.md §4.7.1.3 정리 | 페이지별 `bbrC` 전달이 이미 동작, 최종 권한은 백엔드. 공통화 실익 낮음(YAGNI) |
| `/admin/boards` 레이아웃 | **`layout: 'admin'` 추가** | 타 `/admin/**` 페이지와 일관성. 현재 `middleware: 'admin'`만 선언 |
| `ReviewVersionHistory.formatDateTime` | **도메인 전용 함수명으로 변경** | 축약 표시가 의도이면 공통 `formatDateTime`와 혼동 방지(§4.7.1.1) |
| `useNotifications` 모듈 싱글턴 | **`useState()` 기반 SSR-safe ref 전환** | Pinia보다 경량·Nuxt 관용. 테스트 간 상태 누출·SSR 전역 공유 위험 제거 |
| `useNotifications.refresh()` 호출부 toast | **AppHeader 등 호출부 catch+toast 보장 점검** | composable 계약상 에러 전파, 실호출부 누락 가능 |
| Tiptap 표 도구 계약 문서화 | **TSDoc + `docs/guides/` 계약 문서 추가** | `useTiptapTableTools.ts`/`TiptapTableFloatingToolbar.vue` 복잡도 대비 계약 설명 부족 |

**완료 기준:** 각 결정 반영, `useNotifications` 전환 시 기존 테스트 green 유지.

## 4. 범위 외 (별도 spec)

- **Phase 5 — Mock → API 연동(F):** `info/index.vue` KPI/공지/일정, `budget/summary·comparison.vue` MOCK 제거.
  백엔드 신규 엔드포인트 설계가 필요한 **기능 작업**이므로 순수 리팩토링과 분리하여 별도 기능 spec으로 진행한다.

## 5. 검증 전략

- 단계별: `npm run check`(typecheck+lint) 0/0, `npm test` green.
- Phase 1·3의 로직 변경/추출: 단위 테스트(Vitest) 선행 또는 동반(`tests/unit/**`).
- 협의회·사업집행 등 핵심 화면 변경: 필요 시 Playwright E2E 핵심 시나리오 1개 확인.
- 최종: `npm run format:check` 통과.

## 6. 리스크

- **추출 회귀(Phase 3):** 공개 시그니처 유지 + 호출부 동작 동일성 테스트로 완화.
- **`useNotifications` 전환:** 모듈 싱글턴 → `useState` 전환 시 폴링/드롭다운 상태 동작 회귀 주의. 기존 테스트로 가드.
- **Phase 0 오이관:** 재확인 필요분(cost type-only, D6)은 실코드 확인 전 이관 금지.
