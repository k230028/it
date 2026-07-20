# 사전협의·전자결재 전용 사이드바 및 Home 대시보드 설계

**Date:** 2026-04-24  
**Status:** Approved  
**Approach:** C — 라우팅 재구성 + 신규 대시보드 API

---

## 1. 개요

사전협의(`/info/documents`)와 전자결재(`/approval`) 메뉴에 전용 사이드바 컨텍스트와 Home 대시보드 페이지를 추가한다.
각 메뉴 진입 시 사이드바가 해당 컨텍스트로 자동 전환되며, `/info/documents`와 `/approval`은 대시보드 페이지가 된다.
모든 집계 데이터는 로그인 사용자의 **부서코드(`bbrC`)** 기준으로 필터링하고, 내 결재 대기 목록은 사용자 사번(`eno`) 기준으로 필터링한다.

---

## 2. 라우팅 구조 변경 (Approach C)

### 2.1 사전협의

| Before | After | 비고 |
|--------|-------|------|
| `pages/info/documents/index.vue` (목록) | `pages/info/documents/index.vue` (대시보드) | 파일 교체 |
| — | `pages/info/documents/list.vue` (목록) | 신규 |

- 기존 `index.vue` 내용 → `list.vue`로 이동
- `index.vue`를 새 대시보드로 작성

### 2.2 전자결재

| Before | After | 비고 |
|--------|-------|------|
| `pages/approval/index.vue` (목록) | `pages/approval/index.vue` (대시보드) | 파일 교체 |
| — | `pages/approval/list.vue` (목록) | 신규 |

- 기존 `index.vue` 내용 → `list.vue`로 이동
- `index.vue`를 새 대시보드로 작성

### 2.3 영향받는 내부 링크

| 위치 | 변경 전 | 변경 후 |
|------|---------|---------|
| `AppSidebar.vue` — 문서 목록 링크 | `/info/documents` | `/info/documents/list` |
| `pages/info/documents/[id]/index.vue` — 저장 후 이동 | `/info/documents` | `/info/documents/list` |
| `pages/budget/approval.vue` — 결재 링크 | `/approval` | `/approval/list` |

---

## 3. 사이드바 컨텍스트 확장 (`AppSidebar.vue`)

기존 `사업·예산(info)` 컨텍스트와 동일한 패턴으로 두 개의 컨텍스트를 추가한다.

### 3.1 사전협의 컨텍스트 (`/info/documents/*`)

```
Home                      → /info/documents
─── 문서 관리
    문서 목록             → /info/documents/list
    신규 작성             → /info/documents/new
─── 협의 현황
    검토 중 [배지]        → /info/documents/list?status=reviewing
    협의 완료             → /info/documents/list?status=completed
    반려                  → /info/documents/list?status=rejected
```

**아이콘:** PrimeVue Icons (`pi pi-*`) 사용
- Home: `pi pi-home`
- 문서 목록: `pi pi-list`
- 신규 작성: `pi pi-plus-circle`
- 검토 중: `pi pi-search`
- 협의 완료: `pi pi-check-circle`
- 반려: `pi pi-times-circle`

**배지:** 검토 중 건수 — `/api/documents/dashboard?bbrC=` 응답의 `reviewingCount` 필드

### 3.2 전자결재 컨텍스트 (`/approval/*`)

```
Home                      → /approval
─── 결재함
    결재 대기 [배지]      → /approval/list?tab=pending
    결재 완료             → /approval/list?tab=done
─── 기안함
    결재 진행 중 [배지]   → /approval/list?tab=in-progress
    완료 기안             → /approval/list?tab=draft-done
    반려 기안             → /approval/list?tab=draft-rejected
```

**아이콘:** PrimeVue Icons (`pi pi-*`) 사용
- Home: `pi pi-home`
- 결재 대기: `pi pi-inbox`
- 결재 완료: `pi pi-verified`
- 결재 진행 중: `pi pi-send`
- 완료 기안: `pi pi-folder`
- 반려 기안: `pi pi-replay`

**배지:** 결재 대기 건수 → `pendingCount`, 결재 진행 중 건수 → `inProgressCount` (각각 API 응답에서)

---

## 4. 대시보드 페이지 구성

### 4.1 사전협의 Home (`/info/documents`)

**KPI 카드 (4개, 가로 배치):**
| 카드 | 데이터 | 필드 |
|------|--------|------|
| 전체 문서 | 부서 전체 문서 수 | `totalCount` |
| 검토 진행 중 | 검토 중인 문서 수 | `reviewingCount` |
| 협의 완료 | 협의 완료 문서 수 | `completedCount` |
| 반려 | 반려 문서 수 | `rejectedCount` |

**하단 2열 레이아웃:**
- 좌: 월별 문서 등록 추이 바 차트 (최근 6개월, 부서 기준)
- 우: 검토 중인 요청사항 목록 (최대 3건, 상태 배지 포함)

**데이터 소스:** `GET /api/documents/dashboard?bbrC={bbrC}`

### 4.2 전자결재 Home (`/approval`)

**KPI 카드 (4개, 가로 배치):**
| 카드 | 데이터 | 필드 |
|------|--------|------|
| 결재 대기 | 본인에게 온 결재 대기 수 | `pendingCount` |
| 진행 중 | 내가 기안한 진행 중 수 | `inProgressCount` |
| 이번달 완료 | 이번달 부서 완료 수 | `monthlyCompletedCount` |
| 반려 | 내 반려 수 | `rejectedCount` |

**하단 2열 레이아웃:**
- 좌: 월별 결재 처리 현황 바 차트 (최근 6개월, 부서 기준)
- 우: 내 결재 대기 목록 (최대 3건, 긴급/대기 배지 포함)

**데이터 소스:** `GET /api/applications/dashboard?bbrC={bbrC}&eno={eno}`

---

## 5. 백엔드 API 설계

### 5.1 사전협의 대시보드

```
GET /api/documents/dashboard
Query params: bbrC (required)

Response:
{
  totalCount: number,
  reviewingCount: number,
  completedCount: number,
  rejectedCount: number,
  monthlyTrend: Array<{ month: string, count: number }>,  // 최근 6개월
  recentReviewing: Array<{
    id: string,
    title: string,
    authorName: string,
    createdAt: string,
    status: 'reviewing' | 'delayed' | 'new'
  }>
}
```

**구현 위치:** `council` 도메인 또는 `info/document` 신규 컨트롤러

### 5.2 전자결재 대시보드

```
GET /api/applications/dashboard
Query params: bbrC (required), eno (required)

Response:
{
  pendingCount: number,
  inProgressCount: number,
  monthlyCompletedCount: number,
  rejectedCount: number,
  monthlyTrend: Array<{ month: string, count: number }>,  // 최근 6개월, bbrC 기준
  pendingList: Array<{
    id: string,
    title: string,
    requesterName: string,
    requestedAt: string,
    urgency: 'urgent' | 'normal'
  }>
}
```

**구현 위치:** `common/approval` 도메인 신규 컨트롤러 or 기존 `ApprovalController` 확장

---

## 6. 프론트엔드 Composable 설계

### 6.1 `useDocumentDashboard()`

```ts
// composables/useDocumentDashboard.ts
export function useDocumentDashboard() {
  const { user } = useAuth();
  const { data, pending, refresh } = useApiFetch('/api/documents/dashboard', {
    query: { bbrC: user.value?.bbrC }
  });
  return { data, pending, refresh };
}
```

### 6.2 `useApprovalDashboard()`

```ts
// composables/useApprovalDashboard.ts
export function useApprovalDashboard() {
  const { user } = useAuth();
  const { data, pending, refresh } = useApiFetch('/api/applications/dashboard', {
    query: { bbrC: user.value?.bbrC, eno: user.value?.eno }
  });
  return { data, pending, refresh };
}
```

---

## 7. 구현 순서

1. **백엔드:** 두 대시보드 API 엔드포인트 구현 (집계 쿼리 + DTO)
2. **프론트엔드 — 라우팅:** 기존 `index.vue` → `list.vue` 이동, 내부 링크 정비
3. **프론트엔드 — Composable:** `useDocumentDashboard`, `useApprovalDashboard` 작성
4. **프론트엔드 — 사이드바:** `AppSidebar.vue`에 두 컨텍스트 추가
5. **프론트엔드 — 대시보드 페이지:** 각 `index.vue` 대시보드 UI 구현

---

## 8. 제약 및 결정 사항

- 아이콘은 PrimeVue Icons(`pi pi-*`)만 사용 — 이모지 사용 금지
- 월별 추이 차트는 네이티브 CSS 바 차트로 구현 (Chart.js 등 외부 라이브러리 미사용)
- 대시보드 데이터는 모두 `bbrC` 기준 부서 필터링
- 내 결재 대기 목록만 예외적으로 `eno` 기준 개인 필터링
- `pendingCount`/`inProgressCount` 배지는 API 응답 기반 실시간 연동
