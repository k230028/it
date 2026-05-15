# 프론트엔드 한글 주석 품질 감사 리포트

> 대상: `C:/it/it_frontend/app` (composables / stores / utils / middleware / plugins)
> 기준: CLAUDE.md §4.1 (한글 주석, 입력값·실패조건 기록, 스테일 주석 금지)

---

## 1. 누락된 주석 (Missing Comments)

### 1-A. Composable 최상단 JSDoc — 입력/실패 조건 기술 미흡

| 파일:라인 | 대상 함수 | 제안 한글 주석 |
|-----------|----------|--------------|
| `app/composables/useBudgetStatus.ts:25` | `useBudgetStatus()` 함수 시그니처 | `/** @throws 401 응답 시 useApiFetch가 자동 갱신. 갱신 실패 시 /login 리다이렉트 */` |
| `app/composables/useCodeOptions.ts:42` | `useCodeOptions(cId, mode)` | `/** @param cId 코드ID. 존재하지 않는 코드ID이면 빈 배열 반환(suppressNotFound 기본값 미설정이므로 404 토스트 표시됨) */` |
| `app/composables/useBudgetPeriod.ts:35` | `useBudgetPeriod()` | `/** API 오류(error.value 존재) 시 isWithinPeriod=false — 접근 차단 처리에 유의 */` |
| `app/composables/useBudgetAllocationSummary.ts:85` | `useBudgetAllocationSummary(plnYy)` | `/** @param plnYy 계획 대상년도 Ref. 변경 시 당해·전년도 API 자동 재조회 */` |
| `app/composables/useBudgetStatusCostTab.ts:27` | `useBudgetStatusCostTab(bgYy)` | `/** @param bgYy 예산연도 Ref. 변경 시 prevYearLabel·currYearLabel 자동 갱신 */` |
| `app/composables/useCouncilCodes.ts:29` | `useCouncilCodes()` | `/** suppressNotFound/suppressNetworkError 설정으로 코드 미등록 시 404·네트워크 토스트 억제 */` |

### 1-B. Pinia 스토어 액션 — 실패 조건·부작용 기술 미흡

| 파일:라인 | 대상 액션 | 제안 한글 주석 |
|-----------|----------|--------------|
| `app/stores/review.ts:94` | `loadSession()` | `/** 서버 버전이력·코멘트·검토자 API 실패 시 빈 상태로 폴백 — 사용자는 별도 알림 없이 빈 목록을 봄 (TODO: 토스트/재시도 보강 필요) */` |
| `app/stores/review.ts:187` | `submitForReview()` | `/** 서버 API와 직접 동기화하지 않음 — 메모리 전용 스냅샷 생성. 새로고침 시 초기화됨 */` |
| `app/stores/review.ts:213` | `addComment()` | `/** @throws useReviewCommentApi.createComment 실패 시 예외 전파 — 호출부(useReview)에서 처리 필요 */` |
| `app/stores/review.ts:263` | `viewVersion()` | `/** 과거 버전 본문·코멘트 조회 실패 시 빈 상태로 폴백 — console.warn 없이 완전 삼킴(TODO) */` |

### 1-C. API 래퍼 계층 — 비자명한 호출 지점

| 파일:라인 | 대상 | 제안 한글 주석 |
|-----------|------|--------------|
| `app/composables/useGlobalSearch.ts:51` | `loadAll()` | `/** 에러 발생 시 suggestions를 빈 배열로 초기화. 네트워크 오류는 console.error만 기록 (toast 미표시) */` |
| `app/composables/useHwpxExport.ts:142` | `imageFetch` 내부 catch | `/** 이미지 fetch 실패 시 null 반환 — HWPX에 이미지 누락. src 정보가 로그에 없어 원인 추적 어려움 (TODO: console.warn 추가) */` |
| `app/composables/useCostListPage.ts:85` | `fetchCosts()` 호출 | `/** error ref를 구독하지 않음 — 목록 로딩 실패 시 빈 테이블로 조용히 표시됨 */` |
| `app/composables/useAdminApi.ts:311` | `updateCode()` | `/** sttDt를 URL 쿼리스트링에 직접 보간 — 특수문자 포함 시 URL 인코딩 필요 여부 확인 필요 */` |

### 1-D. 복잡한 페이지 `<script setup>` 블록 (composable 내 비자명 로직)

| 파일:라인 | 대상 | 제안 한글 주석 |
|-----------|------|--------------|
| `app/composables/useCostListPage.ts:139` | `rowKey()` | `/** 서버 저장 전 로컬 신규 행은 itMngcNo가 없으므로 _localId를 대신 사용 */` |
| `app/composables/useTabs.ts:79` | `addTab(newRoute: any)` | `/** @param newRoute Vue Router RouteLocationNormalized — any 타입 사용은 Nuxt 라우터 타입 깊이 제한 우회 목적 */` |
| `app/composables/useAdminTableEdit.ts:88` | `enterEditMode()` | `/** JSON.parse/stringify 깊은 복사 — 함수·undefined·Date가 포함된 행은 직렬화 손실 발생 가능 */` |

---

## 2. 스테일/부정확 주석 (Stale/Incorrect Comments)

| 파일:라인 | 현재 주석 내용 | 실제 코드와의 불일치 | 수정 제안 |
|-----------|-------------|-------------------|----------|
| `app/composables/useBudgetStatus.ts:13` | `// Design Ref: §4.8 — useBudgetStatus.ts` | 영문 설계 참조 주석이 CLAUDE.md §4.1 "한글 주석" 원칙에 위배되며, 문서 버전과 동기화 여부 불명확 | 삭제하거나 한글로 전환: `// 설계 참조: 예산현황 탭 구성 §4.8` |
| `app/composables/useAdminApi.ts:11` | `// [Design Ref: §3.5 — composables/useAdminApi.ts]` | 위와 동일 — 영문 설계 참조, 한글 주석 원칙 위배 | `// 설계 참조: §3.5 관리자 API 구성` |
| `app/stores/review.ts:121` | `// 서버 응답은 버전 내림차순 → 오름차순으로 변환` | 실제 코드는 `[...history].reverse()`로 오름차순 변환 후 map 적용. `createdBy: 'AUTHOR'` 하드코딩은 주석에 언급 없음 | `// 서버 응답(내림차순)을 오름차순으로 변환. createdBy는 현재 하드코딩('AUTHOR') — 서버 응답에 작성자 필드 추가 시 연동 필요` |
| `app/composables/useReviewCommentApi.ts:73` | `// TODO: 서버 응답에 첨부파일 목록이 추가되면...` | `authorTeam: '개발/운영팀'` 하드코딩(72-73줄)이 같은 TODO 블록 밖에 위치하여 TODO와의 연관성이 불명확 | TODO를 `authorTeam` 할당 바로 위로 이동: `// TODO: 작성자 팀명 서버 응답에 추가되면 api.teamName으로 대체 (현재 고정값 '개발/운영팀')` |
| `app/composables/useCostListPage.ts:53` | `cNm: string; // 비목코드 번호 (예: '237-0700') — 표시 비적합` | `IoeCodeOption`은 내부 타입인데 `cNm`을 "비목코드 번호"로 설명하지만 실제 `cNm`은 코드명 컬럼이고 번호는 `cdvaDtlC`임 | `cNm: string; // 코드명 (CCODEM.C_NM) — 비목코드 번호(237-0700)는 cdvaDtlC 필드를 사용` |

---

## 3. 타입 안전성 / 비동기 정확성 주석 경고 (Type-Safety & Async Issues)

> 코드 수정 불가 — 주석으로 경고 기록이 필요한 위치 목록

### 3-A. `any` 캐스트 — 주석 없는 위치

| 파일:라인 | 내용 | 제안 주석 |
|-----------|------|----------|
| `app/composables/useProjects.ts:195` | `payload: any` (createProject) | `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 존재하나 이유 미기재: `// ProjectDetail 포함 any — 품목(items) 포함 여부가 런타임에 결정되어 정적 타입 표현 불가` |
| `app/composables/useProjects.ts:213` | `payload: any` (updateProject) | 동일: `// 부분 업데이트 payload — Partial<ProjectDetail>로 좁히거나 별도 UpdateRequest 타입 정의 권장` |
| `app/composables/useCouncil.ts:164` | `($apiFetch as any)(...)` (requestApproval) | `// Nuxt $apiFetch 타입 깊이 초과로 any 캐스팅. 반환 타입({ apfMngNo: string })은 호출부에서 검증 필요` |
| `app/composables/useCouncil.ts:505` | `($apiFetch as any)(...)` (requestResultApproval) | 동일 패턴: `// 위와 동일 — Nuxt 타입 스택 깊이 초과 임시 회피` |
| `app/composables/useTabs.ts:79` | `newRoute: any` (addTab) | `// Vue Router RouteLocationNormalized 타입 import 시 Nuxt 타입 오류 발생으로 any 사용 — meta.title 접근 시 타입 가드 필요` |
| `app/plugins/auth.ts:81` | `(async (request: any, opts?: any) => {...}) as unknown as typeof $fetch` | `// ofetch 타입 시스템 우회 — $fetch 시그니처와 호환성 확보를 위한 이중 캐스팅. 런타임에는 정상 동작` |

### 3-B. Promise 미처리 / 부유 Promise

| 파일:라인 | 내용 | 제안 주석 |
|-----------|------|----------|
| `app/composables/usePlan.ts:162` | `createPlan()` — `return $apiFetch(...)` (await 없음, 반환 타입 암묵적 `Promise<unknown>`) | `/** @returns Promise — 호출부에서 반드시 await 또는 .catch() 처리 필요. 미처리 시 실패가 조용히 삼켜짐 */` |
| `app/composables/usePlan.ts:179` | `deletePlan()` — 동일 패턴 | `/** @returns Promise — 호출부에서 await 또는 .catch() 처리 필요 */` |
| `app/stores/review.ts:128` | `loadSession()` 내 히스토리/코멘트/검토자 fetch — 3개 try/catch 모두 에러를 완전 삼킴 | 이미 TODO 주석 있으나 severity 명시 부족: `// TODO(HIGH): 세 API 모두 실패를 삼킴 — 사용자가 빈 화면을 보아도 원인을 알 수 없음. console.warn 최소화 후 toast 재시도 정책 수립 필요` |

### 3-C. 타입 좁힘 / 판별 유니온 미주석

| 파일:라인 | 내용 | 제안 주석 |
|-----------|------|----------|
| `app/middleware/auth.global.ts:37` | `getSingleQueryValue(value: unknown)` — `unknown` 입력에 대한 배열/문자열 판별 분기 | 주석 있으나 실패 조건 미기재: `/** null·number·object는 undefined 반환 — 쿼리값이 없는 경우도 undefined로 통일 */` |
| `app/composables/useAdminTableEdit.ts:88` | `enterEditMode()` 내 `JSON.parse(JSON.stringify(...))` | `// 깊은 복사: Date 객체는 ISO 문자열로 변환됨 — 편집 후 서버 전송 시 Date 재변환 필요 여부 확인` |
| `app/composables/useBudgetAllocationSummary.ts:158` | `capGroupMap.get(key)!.items.push(item)` — non-null assertion | `// get()은 has() 직후 호출되므로 항상 존재 보장 — Map 삽입 직후 바로 접근하는 패턴` |

---

## 4. 요약 통계

| 카테고리 | 건수 |
|---------|------|
| 누락 주석 (1-A~D) | 16건 |
| 스테일/부정확 주석 (2) | 5건 |
| 타입/비동기 경고 주석 (3-A~C) | 14건 |
| **합계** | **35건** |

---

## 5. 우선순위 TOP 5

1. **`app/stores/review.ts:94` `loadSession()`** — 3개 API 실패를 완전 삼킴, 사용자·운영자 모두 원인 파악 불가
2. **`app/composables/usePlan.ts:162,179`** — `createPlan`/`deletePlan` 반환 Promise await 미기재, 호출부 오용 위험
3. **`app/composables/useHwpxExport.ts:142`** — 이미지 fetch 실패 시 로그 전혀 없어 HWPX 이미지 누락 디버깅 불가
4. **`app/composables/useCostListPage.ts:85`** — `error` ref 미구독 명시 — 조용한 빈 테이블 현상
5. **`app/composables/useAdminApi.ts:311` `updateCode()`** — URL 쿼리 보간 시 인코딩 위험 미주석
