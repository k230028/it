# 메뉴 관리 기능 설계

- **작성일:** 2026-05-30
- **작성자:** gonnabe88@gmail.com (with Claude)
- **상태:** Draft — 사용자 검토 대기
- **관련 이슈:** 2026-04 IT감사팀 메뉴 임시 숨김 처리에 코드 수정 + 빌드 + 배포로 2일 소요

---

## 1. 배경 및 목적

현재 사이드바 메뉴는 [`it_frontend/app/components/AppSidebar.vue`](../../../it_frontend/app/components/AppSidebar.vue) `menuItems` computed(약 145행)에 **하드코딩**되어 있다. 6개 컨텍스트(`info`, `audit`, `admin`, `board`, `documents`, `approval`)별 트리가 라우트 경로 분기로 표시된다.

이로 인해 다음 운영 부담이 발생한다.

- 메뉴 라벨 변경·임시 숨김·순서 조정 모두 **코드 수정 + 빌드 + 배포**가 필요
- 2026-04 IT감사팀 메뉴 임시 숨김 처리에 2일 소요(실 작업은 1줄 변경)
- 변경 이력 추적 불가 (Git diff에 의존)

**목표:** 시스템관리자(ITPAD001)가 코드 수정 없이 사이드바 메뉴의 **순서·라벨·아이콘·노출 권한·숨김 여부**를 즉시 변경할 수 있게 한다. 또한 메뉴 계층 정보를 활용한 **Breadcrumb**를 헤더 영역에 제공한다.

## 2. 결정사항 요약

| 항목 | 결정 |
|---|---|
| 관리 범위 | **완전 DB화** — 메뉴 트리 전체를 DB로 관리 |
| 컨텍스트 모델 | **단일 테이블 + `ctx_c` 컬럼** |
| 권한 모델 | **자격등급(ROLE) 다중 연결 테이블** (`cmnumr`) |
| 동적 메뉴 처리 | **`mnu_tp='DYNAMIC'` 노드**로 등록, 렌더 시 소스 데이터로 children 치환 |
| 편집 범위 | **신설/삭제 가능**, 단 경로는 **DB 라우트 카탈로그(`cmrte`)에서 선택만** |
| 라우트 카탈로그 | **DB 테이블 `cmrte`로 관리**, FK로 dead link 원천 차단 |
| 계층 표현 | `parent_mnu_id` + Materialized Path(`mnu_pth`) + `dpt_lv` 이중 보유 |
| Breadcrumb | PrimeVue `Breadcrumb` 컴포넌트 사용, `useMenu` 캐시 공유 |
| 권한 필터링 | **서버 단 일원화** (`GET /api/menus` 응답에 ROLE 필터 적용) |
| 캐시 | **Caffeine 로컬 캐시** (Redis 미도입, 단일 WAR) |
| 깊이 제한 | **3단** (현재 `adminLogMenuGroups`가 3단 사용) |
| 롤아웃 | **단일 배포** (백엔드+프론트+시드 동시), 마이그레이션 직후 데이터 검증 강화 |

## 3. 데이터 모델

### 3.1 `cmrte` — 라우트 카탈로그

```
rt_path       VARCHAR2(200)  PK     -- '/budget/approval'
rt_nm         VARCHAR2(100)  NN     -- '결재 상신' (참고 라벨, 메뉴 라벨과 분리)
rt_grp        VARCHAR2(40)          -- 'BUDGET' / 'INFO' / 'ADMIN' / ...
use_yn        CHAR(1)        NN     -- N이면 신규 메뉴 선택 불가, 기존 메뉴는 유지
rmk           VARCHAR2(500)         -- 페이지 설명
fst_enr_eno, fst_enr_dtm, lst_chg_eno, lst_chg_dtm
```

### 3.2 `cmnum` — 메뉴 마스터

```
mnu_id        VARCHAR2(40)   PK     -- 'MNU_INFO_BUDGET_APPROVAL' 등 안정적 키
parent_mnu_id VARCHAR2(40)   FK→self -- NULL이면 루트
ctx_c         VARCHAR2(20)   NN     -- info/audit/admin/board/documents/approval
mnu_nm        VARCHAR2(100)  NN     -- 표시 라벨
mnu_tp        VARCHAR2(10)   NN     -- LINK / GROUP / DYNAMIC
rt_path       VARCHAR2(200)  FK→cmrte -- LINK 타입일 때 필수, NULL이면 GROUP/DYNAMIC
src_key       VARCHAR2(40)          -- DYNAMIC 소스 키 ('BOARD_LIST' 등)
icn_c         VARCHAR2(40)          -- 'pi pi-wallet'
bdg_c         VARCHAR2(40)          -- 배지 키 ('docReviewing', 'approvalPending' 등)
ord_no        NUMBER(5)      NN     -- 같은 부모 내 정렬 (10,20,30 간격)
open_yn       CHAR(1)        NN     -- Y/N (전체 숨김 토글)
dpt_lv        NUMBER(2)      NN     -- 1=루트, 2/3=하위
mnu_pth       VARCHAR2(500)  NN     -- '/MNU_INFO/MNU_INFO_BUDGET/MNU_INFO_BUDGET_APPROVAL'
version       NUMBER         NN     -- 낙관적 잠금 (@Version)
fst_enr_eno, fst_enr_dtm, lst_chg_eno, lst_chg_dtm

CHECK (mnu_tp IN ('LINK','GROUP','DYNAMIC'))
CHECK (open_yn IN ('Y','N'))
CHECK (dpt_lv BETWEEN 1 AND 3)
CHECK ((mnu_tp = 'LINK' AND rt_path IS NOT NULL) OR mnu_tp <> 'LINK')
```

인덱스:
- `(ctx_c, parent_mnu_id, ord_no)` — 사이드바 트리 조회
- `(rt_path)` — Breadcrumb 역인덱스

### 3.3 `cmnumr` — 메뉴-자격등급 매핑

```
mnu_id  VARCHAR2(40)  PK,FK→cmnum (ON DELETE CASCADE)
ath_id  VARCHAR2(20)  PK            -- ITPAD001 / ITPZZ001 / ITPZZ002

-- 규칙:
-- 매핑이 0건 = 모든 로그인 사용자 노출 (전체 공개)
-- 매핑이 1건 이상 = 해당 ROLE 보유자에게만 노출
```

### 3.4 `cmnuh` — 메뉴 변경 이력

```
log_seq    NUMBER         PK
mnu_id     VARCHAR2(40)   NN
chg_tp     VARCHAR2(10)   NN     -- INSERT / UPDATE / DELETE / MOVE / REORDER
bf_json    CLOB                  -- 변경 전 스냅샷
af_json    CLOB                  -- 변경 후 스냅샷
chg_eno    VARCHAR2(20)   NN
chg_dtm    TIMESTAMP      NN
```

`ADMIN_LOG_TABLES`에 `cmnuh` 추가 → 관리자 로그 화면(`/admin/logs/cmnuh`)에서 조회.

### 3.5 정합성 유지

- `mnu_pth`/`dpt_lv`는 **백엔드 `AdminMenuService` 계층에서 계산·저장** (트리거 사용 안 함, 디버깅·테스트 용이)
- 부모 이동 시 모든 후손의 `mnu_pth` 일괄 갱신 (트랜잭션 내 재귀 update)
- 순환 참조 방지: 자기 자신 또는 후손을 부모로 지정 시 400
- 깊이 초과: 이동 후 depth가 3 초과 시 400

## 4. 백엔드 API

### 4.1 패키지 구조

```
it_backend/.../menu/
├── controller/
│   ├── MenuQueryController.java      -- 사용자용 (조회)
│   ├── AdminMenuController.java      -- 관리자용 (메뉴 CRUD)
│   └── AdminRouteController.java     -- 관리자용 (라우트 카탈로그 CRUD)
├── service/
│   ├── MenuQueryService.java
│   ├── AdminMenuService.java         -- mnu_pth/dpt_lv 재계산 책임
│   └── AdminRouteService.java
├── repository/ (Menu, MenuRole, MenuHistory, Route)
├── entity/    (Menu, MenuRole, MenuHistory, Route)
└── dto/       (MenuNodeDto, MenuTreeDto, MenuUpsertReq, ReorderReq, MoveReq)
```

### 4.2 엔드포인트

| Method | Path | 권한 | 용도 |
|---|---|---|---|
| GET | `/api/menus` | 인증사용자 | 전체 메뉴 트리 (사이드바·Breadcrumb 공용). 서버에서 ROLE 필터 + `open_yn='Y'` 필터 적용 |
| GET | `/api/admin/menus` | ADMIN | 관리화면용 전체 메뉴 (`open_yn='N'` 포함) |
| POST | `/api/admin/menus` | ADMIN | 단건 생성 |
| PUT | `/api/admin/menus/{mnuId}` | ADMIN | 단건 수정 (라벨·아이콘·경로·권한·open_yn) |
| DELETE | `/api/admin/menus/{mnuId}` | ADMIN | 단건 삭제 (후손 존재 시 409) |
| PATCH | `/api/admin/menus/reorder` | ADMIN | 같은 부모 내 일괄 순서 변경 |
| PATCH | `/api/admin/menus/{mnuId}/move` | ADMIN | 부모 이동 + 후손 일괄 재계산 |
| GET | `/api/admin/menus/{mnuId}/history` | ADMIN | 변경 이력 |
| GET | `/api/admin/routes` | ADMIN | 라우트 카탈로그 (use_yn='Y'만) |
| GET | `/api/admin/routes/all` | ADMIN | 라우트 카탈로그 전체 |
| POST/PUT/DELETE | `/api/admin/routes` | ADMIN | 라우트 CRUD |

### 4.3 보안

- 모든 `Admin*Controller`는 **클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")`** (CLAUDE.md §4.4.1 이중 보호)
- `GET /api/menus`는 인증만 요구하되 서버에서 `cmnumr` 매핑과 `authUser.athIds` 교집합으로 필터
- 프론트는 받은 트리를 그대로 렌더 → 권한 판단 책임 서버 일원화

### 4.4 캐싱

- `GET /api/menus`: `@Cacheable("menus")`, 캐시 키에 ROLE 포함
- `AdminMenuService` 변경 시 `@CacheEvict(value="menus", allEntries=true)`
- `cmrte` 변경은 `cmnum` 캐시에 영향 없음 (별도 캐시)
- Caffeine 로컬 캐시. 다중 인스턴스 확장 시 Redis 전환(TASK.md 등록)

### 4.5 핵심 서비스 로직 — `AdminMenuService.move(...)`

1. 대상 노드 + 모든 후손 SELECT (`WHERE mnu_pth LIKE '/oldPath/%'`)
2. 새 parent의 `mnu_pth`·`dpt_lv` 기준으로 본인 갱신
3. 후손들의 `mnu_pth`는 `replace(oldPrefix, newPrefix)`, `dpt_lv`는 차이만큼 가감
4. 같은 트랜잭션에서 `cmnuh` INSERT
5. depth 3 초과 또는 순환 참조 → `IllegalArgumentException` → 400
6. 캐시 evict

## 5. 프론트엔드 통합

### 5.1 신규/변경 파일

```
app/
├── composables/
│   ├── useMenu.ts          ★신설
│   └── useAdminMenu.ts     ★신설
├── components/
│   ├── AppSidebar.vue      ◇리팩토링 (menuItems 하드코딩 제거)
│   └── AppBreadcrumb.vue   ★신설
├── pages/admin/
│   ├── menus/index.vue     ★신설
│   └── routes/index.vue    ★신설
├── types/
│   └── menu.ts             ★신설 (MenuNode, MenuTree, RouteCatalog)
└── layouts/
    └── default.vue         ◇수정 (AppBreadcrumb 삽입)
```

### 5.2 `useMenu.ts` 책임

- `GET /api/menus` 호출 (`useApiFetch`, 401 자동 갱신)
- 평탄화 응답 → 다음 computed 노출:
  - `treeByContext: Record<ContextCode, MenuNode[]>` — 사이드바용 트리
  - `nodeByPath: Map<string, MenuNode>` — Breadcrumb 역인덱스
  - `nodeById: Map<string, MenuNode>` — `mnu_pth` split 매핑
- 동적 메뉴 해석:
  - `mnu_tp='DYNAMIC' && src_key='BOARD_LIST'` 노드는 `useBoard().sidebarBoards`를 children으로 주입
  - 새 src_key 추가 시 useMenu 내부에서 매핑 추가 (코드 변경 필요)
- 캐시 무효화: `/admin/menus` 저장 후 `refresh()` 호출 → 사이드바·Breadcrumb 즉시 반영

### 5.3 `AppSidebar.vue` 리팩토링

- `menuItems = computed(...)` 거대 블록(약 145행) **전체 삭제**
- 데이터 소스: `const { treeByContext } = useMenu(); const menuItems = computed(() => treeByContext.value[context.value] ?? []);`
- 동적 메뉴 children 주입은 `useMenu` 내부에서 처리 → 사이드바는 소스 무관
- 배지(`bdg_c`)·아이콘(`icn_c`)·관리자 표시는 노드 필드에서 직접 읽음
- **템플릿(약 190행)은 그대로 유지** — 데이터 소스만 교체

### 5.4 `AppBreadcrumb.vue`

PrimeVue `Breadcrumb` 컴포넌트 사용.

```vue
<script setup lang="ts">
import Breadcrumb from 'primevue/breadcrumb';
const route = useRoute();
const { nodeByPath, nodeById } = useMenu();

const home = { icon: 'pi pi-home', route: '/' };

const items = computed(() => {
  const current = nodeByPath.value.get(route.path);
  if (!current) return [];
  return current.mnu_pth.split('/').filter(Boolean).map(id => {
    const node = nodeById.value.get(id);
    return {
      label: node?.mnu_nm ?? id,
      route: node?.mnu_tp === 'LINK' ? node.rt_path : undefined,
    };
  });
});
</script>

<template>
  <Breadcrumb v-if="items.length" :home="home" :model="items" />
</template>
```

- 마지막 노드, `route` 없는 GROUP 항목은 PrimeVue가 자동 비활성 처리
- 배치: `layouts/default.vue` 상단 헤더 아래
- 카탈로그 외 페이지(로그인 등)에서는 렌더링하지 않음

### 5.5 관리화면 `/admin/menus`

- **좌측:** PrimeVue `Tree` (drag&drop 활성화)
- **우측 편집 폼:** `mnu_nm`, `icn_c`, `mnu_tp`, `rt_path`(Dropdown ← `/api/admin/routes`), `bdg_c`, `open_yn`, 역할 체크박스
- **상단 액션:** [신규] [이력] [삭제]
- 드래그&드롭 부모 변경 → `move` API
- 같은 부모 내 순서 변경 → `reorder` API 일괄 호출
- 저장 후 `useMenu().refresh()`

### 5.6 관리화면 `/admin/routes`

- `StyledDataTable`로 라우트 카탈로그 관리
- `useAdminTableEdit` 컴포저블과 함께 사용 (CLAUDE.md §4.9)
- 컬럼: `rt_path`, `rt_nm`, `rt_grp`, `use_yn`, `rmk`, 표준 audit

### 5.7 미들웨어/라우트 가드

- 기존 `middleware/admin.ts` 유지 (서버 권한이 최종 보안 경계)
- 라우트 자체의 권한 제어는 변하지 않음 — DB는 "메뉴 노출 여부"만 책임
- `/admin/menus`·`/admin/routes` 페이지는 `definePageMeta({ middleware: 'admin', layout: 'admin' })`

### 5.8 메뉴 관리 메뉴 자체

- `cmnum` 시드에 `MNU_ADMIN_MENUS`, `MNU_ADMIN_ROUTES` 추가
- `cmnumr`에 `ITPAD001` 매핑만 추가 → 일반 사용자에게 비노출
- 사이드바 `admin` 컨텍스트의 "데이터 관리" 그룹 하위에 배치

## 6. 마이그레이션

Flyway 파일 3개 (CLAUDE.md §4.4 명명 규칙 준수).

### 6.1 `V20260530_001__CreateMenuTables.sql`

- `cmrte`, `cmnum`, `cmnumr`, `cmnuh` 테이블 + 인덱스 + FK + CHECK 제약
- 시퀀스: `cmnuh_seq`

### 6.2 `V20260530_002__SeedRouteCatalog.sql`

- 현재 `AppSidebar.vue`에서 사용 중인 모든 `to` 경로 약 60건 INSERT
- `rt_grp`는 경로 prefix 기반 분류
- `use_yn='Y'`로 일괄 등록

### 6.3 `V20260530_003__SeedMenuTree.sql`

- `AppSidebar.vue`의 모든 `menuItems` 노드를 `cmnum`에 INSERT
- `mnu_pth`·`dpt_lv` 명시 계산 후 저장
- `cmnumr` 매핑: `admin: true` → `ITPAD001` 1행, 그 외 → 매핑 0건(전체 공개)
- 동적 메뉴: `BOARD_LIST` 노드 1건 (`mnu_tp='DYNAMIC'`, `src_key='BOARD_LIST'`)
- 관리 메뉴 자체 노드(`MNU_ADMIN_MENUS`, `MNU_ADMIN_ROUTES`) 포함

### 6.4 시드 정확성 검증 (필수)

배포 직후 다음 검증 스크립트 실행:

- `GET /api/menus` (ROLE=ADMIN)의 응답 트리를 현재 하드코딩 메뉴와 비교
- 라벨·순서·아이콘·경로·권한·배지 모두 일치 확인
- 불일치 항목이 있으면 hotfix 마이그레이션(`V20260530_004__...`)으로 즉시 보정
- 검증 스크립트는 `it_database/scripts/verify-menu-seed.ts` 등으로 보관

## 7. 롤아웃 전략 — 단일 배포

백엔드 + 프론트 + 시드를 **한 번에 배포**한다.

- 시드와 현재 코드 메뉴가 1:1 일치하므로 사용자 체감 변화 없음
- 첫 효과: 관리자가 4월 IT감사팀 같은 케이스를 코드 수정 없이 처리 가능

### 7.1 배포 직후 검증 (강화)

- 마이그레이션 적용 직후 §6.4 검증 스크립트 실행
- 운영 사용자 일부(관리자 본인 + 1팀)로 사이드바·Breadcrumb·관리화면 스모크 테스트
- Caffeine 캐시 정상 evict 확인 (`/admin/menus`에서 라벨 변경 → 사이드바 새로고침 시 반영)

### 7.2 롤백

- 프론트 문제: 직전 커밋으로 revert → DB는 잔존(영향 없음)
- 백엔드 문제: API 비활성화 또는 직전 WAR 배포, 테이블은 잔존
- 시드 문제: hotfix 마이그레이션으로 보정 (downgrade 안 함)

## 8. 테스트 계획

| 레이어 | 도구 | 대상 |
|---|---|---|
| Backend Unit | JUnit | `AdminMenuService.move()` — mnu_pth 후손 일괄 갱신, depth 제한, 순환 방지 |
| Backend Unit | JUnit | `AdminMenuService.delete()` — 후손 존재 시 409 |
| Backend Unit | JUnit | `AdminMenuService.reorder()` — 같은 부모 내 ord_no 일괄 갱신 |
| Backend Integration | `@SpringBootTest` | `/api/menus` 권한 필터링 (ADMIN vs USER 응답 비교) |
| Backend Integration | `@SpringBootTest` | `/api/admin/menus` `@PreAuthorize` — 비관리자 403 |
| Backend Integration | `@SpringBootTest` | `cmnum.rt_path` FK — 카탈로그에 없는 경로 저장 시 제약 위반 |
| Frontend Unit | Vitest | `useMenu` — treeByContext 변환, nodeByPath 인덱스, 동적 노드 children 주입 |
| Frontend Unit | Vitest | `AppBreadcrumb` — mnu_pth split → items 변환, LINK/GROUP 구분 |
| Frontend E2E | Playwright | 관리자가 메뉴 숨김 토글 → 사이드바 즉시 반영 (4월 이슈 회귀 방지) |
| Frontend E2E | Playwright | 일반 사용자에게 admin 전용 메뉴 미노출 |

## 9. 리스크 및 완화책

| 리스크 | 완화책 |
|---|---|
| 시드와 코드 메뉴 불일치로 운영 후 메뉴 누락 | §6.4 검증 스크립트 자동화, 배포 직후 필수 실행 |
| 관리자가 본인을 모든 메뉴에서 제외 후 자기 잠금 | `/admin/menus` 자체는 `middleware/admin`으로 항상 접근 가능 — DB 설정과 무관 |
| 동시 편집으로 `mnu_pth` 충돌 | `cmnum`에 `@Version` 낙관적 잠금, 충돌 시 409 + 사용자에게 재시도 안내 |
| Caffeine 캐시 다중 인스턴스 비동기화 | 현 운영은 단일 WAR. 확장 시 Redis 전환 → `TASK.md` 등록 |
| 신규 페이지 추가 시 `cmrte` 등록 누락 | 루트 `CLAUDE.md` §4에 체크리스트 명시, PR 템플릿에 항목 추가 |
| DYNAMIC 메뉴 소스 추가 시 코드 변경 필요 | `BOARD_LIST` 외 동적 소스가 늘어나면 `useMenu` 내부 매핑 테이블 분리 — 현재는 YAGNI |

## 10. 문서 업데이트

- `it_backend/CLAUDE.md`: `menu` 패키지 추가 설명
- `it_frontend/CLAUDE.md` §4.6: `pages/admin/menus`, `pages/admin/routes` 추가
- 루트 `CLAUDE.md` §4: **신규 페이지 추가 시 `cmrte` 등록 필수** 워크플로우 명시
- `TASK.md`: 다중 인스턴스 확장 시 Redis 전환, DYNAMIC 소스 분리

## 11. 향후 과제 (이 설계 범위 밖)

- 메뉴별 통계(클릭 수, 마지막 접근 시각) — 사용 빈도 기반 정렬 추천
- 사용자별 즐겨찾기 메뉴
- 다국어 라벨 (`mnu_nm_en` 컬럼 등)
- DYNAMIC 메뉴 소스 카탈로그(현재는 useMenu 내부 매핑)
