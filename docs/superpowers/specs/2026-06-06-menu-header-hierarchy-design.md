# 메뉴 관리체계 3계층 개편 (HED 헤더 계층 도입) — 설계서

- **작성일**: 2026-06-06
- **대상**: `it_database`(메뉴 테이블/시드), `it_backend`(menu 도메인), `it_frontend`(헤더·사이드바·관리자 메뉴)
- **상태**: 설계 승인 → 구현 계획 작성 예정

---

## 1. 배경 / 문제

현재 메뉴는 **2계층**(사이드바 GRP/LNK → 서브 LNK)이며, 최상단 그룹핑은 다음 두 가지로 분산되어 있다.

- `TPRMPP_CMENUM.SYS_HRK_MNU_ID` 코드(`01`~`06`)가 루트 노드를 시스템 컨텍스트로 묶음 — 단, **실제 메뉴 노드가 아님**(원시 코드), 관리자 화면에서 관리 불가.
- `AppHeader.vue`의 **하드코딩된 7개 탭**(사전협의·사업·예산·IT·AI CDP·IT자체감사·전자결재·게시판·관리자)이 라우트 prefix로 사이드바 컨텍스트를 전환.

즉 "헤더"는 이미 존재하지만 데이터 기반이 아니고, 계층 모델에 정식으로 편입되어 있지 않다.

### 목표

헤더를 **실제 DB 메뉴 노드(`HED` 타입)** 로 승격하여,

1. 메뉴 트리를 **HED → GRP/LNK → 서브 링크**의 진짜 3계층 자기참조 트리로 통합한다.
2. 헤더를 **관리자 화면에서 관리 가능**하게 만든다(라벨·정렬·노출 권한).
3. 하드코딩/원시코드 그룹핑(`SYS_HRK_MNU_ID`)을 제거한다.

### 비목표 (YAGNI)

- IT/AI CDP의 실제 하위 메뉴·화면 구축 — 이번엔 **빈 헤더(플레이스홀더)** 만 생성.
- `/admin/menus` 편집 폼의 기존 `athIds` 초기화 버그 수정 — 인지만 하고 범위 외.
- 4계층을 초과하는 더 깊은 중첩 지원.

---

## 2. 설계 결정 (확정)

| # | 결정 | 선택 |
|---|---|---|
| D1 | 목적 | **DB 기반 + 계층 재구성 (둘 다)** |
| D2 | 모델링 | **Approach 1 — 통합 트리**: HED를 `HRK_MNU_ID`로 연결되는 실제 부모 노드로. `SYS_HRK_MNU_ID` 폐기, 전체 `WHL_MNU_PTH` 재계산, 최대 깊이 4. |
| D3 | CDP 범위 | **빈 헤더로 생성** (플레이스홀더 자식 1개) |
| D4 | 빈/무권한 헤더 표시 | **플레이스홀더 자식** 방식 — 기존 prune 규칙 그대로. 의도적 빈 헤더(CDP)는 placeholder LNK로 노출, 권한 없는 헤더(관리자)는 자식 미인가로 자동 숨김. 특수 prune 로직 불필요. |

---

## 3. 데이터 모델 변경

### 3.1 스키마 (`TPRMPP_CMENUM`)

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| `MNU_TP_C` CHECK | `IN ('LNK','GRP','DYN')` | `IN ('LNK','GRP','DYN','HED')` |
| `MNU_DEP` CHECK | `BETWEEN 1 AND 3` | `BETWEEN 1 AND 4` |
| `SYS_HRK_MNU_ID` | `VARCHAR2(10) NOT NULL` | **컬럼 제거** |
| 인덱스 `IDX_CMENUM_TREE` | `(SYS_HRK_MNU_ID, HRK_MNU_ID, MNU_SOT_SQN_SNO)` | `(HRK_MNU_ID, MNU_SOT_SQN_SNO)` 로 재생성 |

- 로그 테이블 `TPRMPP_CMENUL` 도 동일하게 `SYS_HRK_MNU_ID` 컬럼 제거(엔티티 `@LogTarget` 미러링 일치 목적). 이력 스냅샷은 운영용이며 규제 보존 대상 아님.

### 3.2 신규 HED 노드 (7개) 및 자식 재배치

| HED ID | 헤더명(MNU_NM) | 정렬(SOT) | 노출권한(CMENUA) | 자식 = 기존 루트(구 SYS 코드) |
|---|---|---|---|---|
| `MHED0001` | 사전협의 | 10 | 공개 | `MDOC0001`, `MDOC0002`, `MDOC0005` (구 05) |
| `MHED0002` | 사업/예산 | 20 | 공개 | `MINF0001`, `MINF0002`, `MINF0003`, `MINF0009`, `MINF0012`, `MINF0015` (구 01) |
| `MHED0003` | IT/AI CDP | 30 | 공개 | `MCDP0001` (신규 플레이스홀더 LNK) |
| `MHED0004` | IT자체감사 | 40 | 공개 | `MAUD0001`, `MAUD0002`, `MAUD0008` (구 02) |
| `MHED0005` | 전자결재 | 50 | 공개 | `MAPV0001`, `MAPV0002`, `MAPV0005` (구 06) |
| `MHED0006` | 게시판 | 60 | 공개 | `MBRD0001` (DYN, 구 04) |
| `MHED0007` | 관리자 | 70 | **ROLE_ADMIN(`ITPAD001`)** | `MADM0001`,`MADM0002`,`MADM0003`,`MADM0004`,`MADM0010`,`MADM0012`,`MADM0016`,`MADM0017` (구 03 루트 8개) |

- HED 노드 공통: `HRK_MNU_ID = null`, `SRE_PTH = null`, `MNU_TP_C = 'HED'`, `MNU_DEP = 1`, `WHL_MNU_PTH = /{HED_ID}`, `HID_YN = 'N'`.
- 헤더 정렬 순서는 요청된 순서(사전협의 → 사업/예산 → IT/AI CDP → IT자체감사 → 전자결재 → 게시판 → 관리자).
- `관리자` 헤더는 `CMENUA`에 `ITPAD001` 매핑을 추가하여 일반 사용자에게 헤더 자체가 숨겨지도록 한다(자식 무인가 → prune).

### 3.3 CDP 플레이스홀더

- `MCDP0001` : `MNU_NM='준비중'`, `MNU_TP_C='LNK'`, `HRK_MNU_ID='MHED0003'`, `SRE_PTH='/cdp'`, `MNU_DEP=2`, `WHL_MNU_PTH='/MHED0003/MCDP0001'`.
- 라우트 카탈로그 `TPRMPP_CMENUD`에 `/cdp` 선등록(LNK FK 전제).

### 3.4 깊이/경로 재계산 규칙

- 모든 기존 루트(depth 1, `HRK_MNU_ID=null`) → 해당 HED를 부모로 (`HRK_MNU_ID={HED_ID}`), `MNU_DEP +1`, `WHL_MNU_PTH` 앞에 `/{HED_ID}` 접두.
- 모든 하위 노드 → `MNU_DEP +1`, `WHL_MNU_PTH` 동일하게 접두 갱신.
- 신규 최대 깊이 검증: `관리자(MHED0007, d1) → 상세 로그(MADM0017, d2) → 전산예산(MADM0018, d3) → 예산 작업·편성 결과(MADM0019, d4)` = depth 4 ✓ (상한 내).

---

## 4. 마이그레이션 (순서/멱등)

경로: `it_database/migrations/`, 네이밍 `V{YYYYMMDD_NNN}__{설명}.sql` (CLAUDE.md §4.4).

1. **`V20260606_005__AddHedMenuTypeAndDepth.sql`**
   - `CK_CMENUM_TP` 재정의(+`HED`), `CK_CMENUM_DEP` 재정의(→4). `CMENUL` 동일.
   - 멱등: 제약 존재 시 drop 후 add.
2. **`V20260606_006__InsertHeadersAndReparent.sql`**
   - `TPRMPP_CMENUD`에 `/cdp` 라우트 삽입(MERGE).
   - HED 7행 + `MCDP0001` 삽입(MERGE on `MNU_ID`).
   - `CMENUA`에 `MHED0007 ↔ ITPAD001` 매핑 삽입(MERGE).
   - 기존 루트 reparent + 전체 `MNU_DEP`/`WHL_MNU_PTH` 재계산 (단계적 UPDATE 또는 `CONNECT BY` 기반).
   - 멱등: 이미 reparent 된 경우(루트가 HED를 부모로 가짐) 재실행 안전.
3. **`V20260606_007__DropSysHrkMnuId.sql`**
   - `IDX_CMENUM_TREE` drop → `SYS_HRK_MNU_ID` 컬럼 drop(`CMENUM`,`CMENUL`) → 신규 인덱스 `(HRK_MNU_ID, MNU_SOT_SQN_SNO)` 생성.
   - 멱등: 컬럼/인덱스 존재 여부 확인 후 처리.

> 일련번호(005~007)는 기존 `V20260606_004` 다음으로 가정. 구현 시 충돌 확인 후 확정.

---

## 5. 백엔드 변경 (`com.kdb.it.domain.menu`)

| 파일 | 변경 |
|---|---|
| `entity/Cmenum.java` | `sysHrkMnuId` 필드 제거 |
| `entity/CmenumL.java` | `sysHrkMnuId` 필드 제거 (로그 미러) |
| `dto/MenuDto.java` | `Node.sysHrkMnuId` 제거 (그룹핑은 트리 중첩으로 표현) |
| `service/MenuQueryService.java` | `SYS_HRK_MNU_ID` 기반 그룹핑 제거. 트리는 HED 루트로 자연 시작. `prune()` 로직 유지(플레이스홀더가 CDP 보존). |
| `service/AdminMenuService.java` | `validateTypePath()`에 HED 규칙 추가: HED는 `SRE_PTH` null·루트(depth 1) 전용, **모든 루트는 HED**·비-HED 루트 금지. `create()`/`move()` 깊이 상한 4, HED를 다른 노드 밑으로 이동 금지. |
| `repository/CmenumRepository.java` | `SYS_HRK_MNU_ID` 참조 쿼리 정리(정렬/조회). |
| `controller/MenuQueryController.java` | `GET /api/menus` 응답 shape 변경(HED 루트 트리). 소비자는 `useMenu` 단일. |

---

## 6. 프론트엔드 변경 (`it_frontend/app`)

| 파일 | 변경 |
|---|---|
| `types/menu.ts` | `CONTEXT_BY_SYS_HRK_MNU_ID` 삭제. `Node` 타입에 `HED` 추가, `sysHrkMnuId` 제거. |
| `composables/useMenu.ts` | `treeByContext` 제거 → `headerNodes`(HED 루트 목록) 노출. 현재 라우트의 조상 HED로 `activeHeader` 해석 → `sidebarTree = activeHeader.children`. `nodeById`/`nodeByPath` 유지. |
| `components/AppHeader.vue` | 하드코딩 `navItems` 제거 → `headerNodes` 렌더. 활성 상태 = `activeHeader.id`. 라벨·정렬 DB 기반. 관리자 노출은 prune으로 자동(수동 `ITPAD001` 체크 제거). |
| `components/AppSidebar.vue` | 라우트 prefix 컨텍스트 로직 제거 → `activeHeader.children` 렌더. 템플릿 depth 4까지 대응. |
| `utils/menuPresentation.ts` | `MENU_ICON`에 HED 7개 + `MCDP0001` 아이콘 추가. 기존 MNU_ID 불변이므로 나머지 맵 유지. |
| `pages/cdp/index.vue` (신규) | `/cdp` 준비중(coming-soon) 페이지. |
| `pages/admin/menus/index.vue` | 유형 Select에 `HED` 추가. `시스템상위메뉴ID` 입력 필드 제거. 드래그드롭 HED 루트 규칙 검증. (라우트 카탈로그 `/cdp`는 시드로 존재.) |

---

## 7. 엣지 케이스

- **비관리자**: 관리자 HED 자식 전부 무인가 → prune으로 헤더 자동 숨김 ✓
- **CDP**: `MCDP0001` 전원 노출 → 헤더 표시, 사이드바에 "준비중" 링크 ✓
- **딥링크** `/admin/logs/bbugt`: 노드 → 조상 HED(`MHED0007`)로 활성 헤더 해석 ✓
- **게시판 DYN**: `MBRD0001`이 depth 2로 내려가도 `BoardListMenuResolver` 무관 ✓
- **이동 검증**: HED를 비-HED 밑으로 이동 / 비-HED를 루트로 승격 시 거부 ✓

---

## 8. 테스트 계획

- **백엔드 단위**
  - `MenuQueryService`: HED 루트 트리 구성, prune 시 CDP 보존·관리자 숨김, 비관리자 필터링.
  - `AdminMenuService`: HED 검증(루트/SRE_PTH null), 깊이 상한 4, HED 이동 금지, 비-HED 루트 금지.
- **마이그레이션 검증**: reparent 후 전 노드 `MNU_DEP`/`WHL_MNU_PTH` 정합, 최대 depth ≤ 4, `SYS_HRK_MNU_ID` 부재.
- **프론트 단위**: `useMenu` — `headerNodes` 산출, 라우트별 `activeHeader` 해석, `sidebarTree` 매핑.
- **E2E(스모크)**: 헤더 7탭 노출(관리자 권한별), 탭 클릭 시 사이드바 전환, CDP "준비중" 진입.

---

## 9. 리스크 / 롤백

- **리스크**: `GET /api/menus` 응답 shape 변경 — 단일 소비자(`useMenu`)이므로 영향 국소. 마이그레이션 3단계가 순서 의존적 → Flyway 순차 적용 보장.
- **롤백**: 컬럼 drop(3단계)은 비가역적이므로, 단계별 배포 시 1·2단계 검증 후 3단계 분리 적용 권장. 필요 시 `SYS_HRK_MNU_ID` 백필 + 재추가 역마이그레이션을 별도 작성.
