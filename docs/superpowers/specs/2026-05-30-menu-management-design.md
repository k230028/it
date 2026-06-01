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
| 화면 영역 모델 | **단일 테이블 + `SRE_C` 컬럼** (info/audit/admin/board/documents/approval) |
| 권한 모델 | **자격등급(ROLE) 다중 연결 테이블** (`cmenur` / `TPRMPP_CMENUR`) |
| 동적 메뉴 처리 | **`MNU_TP='DYNAMIC'` 노드**로 등록, 서버 응답 생성 시 권한 필터링된 children으로 치환 |
| 편집 범위 | **신설/숨김 가능**, 단 경로는 **검증된 DB 라우트 카탈로그(`cmenud`)에서 선택만** |
| 라우트 카탈로그 | **DB 테이블 `cmenud` / `TPRMPP_CMENUD`로 관리**, FK + 라우트 검증 스크립트로 dead link 방지 |
| 계층 표현 | `HRK_MNU_ID` + Materialized Path(`HRK_PTH`) + `DEP_LEV` 이중 보유 |
| 변경 로그 | **`BaseLogEntity` 상속 (`CmenumL`/`TPRMPP_CMENUL`)** — `ChangeLogEntityListener` 자동 적재, 스냅샷 방식 |
| Breadcrumb | PrimeVue `Breadcrumb` 컴포넌트 사용, `useMenu` 캐시 공유 |
| 권한 필터링 | **서버 단 일원화** (`GET /api/menus` 응답에 ROLE 필터 적용) |
| 캐시 | **도입하지 않음** — 70행 규모 + 인덱스로 충분, 측정 후 필요 시 TASK 백로그에서 검토 |
| 깊이 제한 | **3단** (현재 `adminLogMenuGroups`가 3단 사용) |
| 롤아웃 | **단일 배포** (백엔드+프론트+시드 동시), 마이그레이션 직후 데이터 검증 강화 |

## 3. 데이터 모델

### 3.0 명명 규약 검증

테이블·컬럼명은 [META.md](../../../META.md), [DOMAIN.md](../../../DOMAIN.md), `it_backend/CLAUDE.md` §5.2(테이블 명명), §5.12.1(BaseLogEntity 로깅 패턴)에 맞춰 확정했다.

**확인된 표준어** (META.md 출처, 모두 등재어):
- 메뉴=MNU(2234), 명세=SFS(2316), 관계=REL(1435), 기본=BSC(1715), 로그=LOG(2146)
- 경로=PTH(1245), 상위=HRK(3152), 순서=SQN(3552), 깊이=DEP(1790), 레벨=LEV(2140)
- 숨김=HID(3560), 그룹=GRP(1572), 코드=C(5665), 비고=RMK(DOMAIN)
- **화면=SRE(6261)** — 컨텍스트(info/audit/admin 등 화면 영역 구분) 대체
- **이미지=IMG(4453)** — 아이콘(시각 식별자) 대체
- **알림=INFM(3790)** — 배지(미상신/검토중 등 알림 카운트) 대체
- **원천=FNT(4269)** — 소스(DYNAMIC 메뉴의 데이터 원천) 대체

> META.md 신규 등재 금지 원칙 준수 — 미등재어는 모두 의미가 가장 가까운 등재어로 매핑함.

**테이블 후미 표준 외 사용 (TASK.md 등록):**
CLAUDE.md §5.2는 후미를 `M`(마스터)/`L`(로그)/`H`(이력)으로 한정한다. 사용자 결정에 따라 `D`(명세, Definition), `R`(관계, Relation) 후미를 신규 도입하므로 §5.2를 업데이트해야 한다.

> 구현 순서 주의: `D`/`R` 후미 도입은 현 SoT와 충돌하므로, 메뉴 기능 구현 PR보다 먼저 `it_backend/CLAUDE.md` §5.2와 루트 운영 규약을 보강한다. SoT 갱신 전에는 마이그레이션/엔티티명 리뷰에서 `TPRMPP_CMENUD`, `TPRMPP_CMENUR` 명칭을 확정한 것으로 취급하지 않는다.

**테이블 매핑:**
| 엔티티 | 테이블 | 역할 |
|---|---|---|
| `cmenud` | `TPRMPP_CMENUD` | 공통메뉴명세 — 라우트 카탈로그 (도메인 경로) |
| `cmenum` | `TPRMPP_CMENUM` | 공통메뉴기본 — 메뉴 마스터 |
| `cmenur` | `TPRMPP_CMENUR` | 공통메뉴관계 — 메뉴↔자격등급 |
| `cmenul` | `TPRMPP_CMENUL` | 공통메뉴로그 — 변경 스냅샷 (BaseLogEntity 상속) |

### 3.1 `TPRMPP_CMENUD` — 공통메뉴명세 (라우트 카탈로그)

`Cmenud` 엔티티, `BaseEntity` 상속.

라우트 카탈로그는 FK 대상이지만, FK만으로 실제 Nuxt 라우트 존재 여부를 보장할 수 없다. 운영자가 존재하지 않는 경로를 `cmenud`에 등록하면 이후 `cmenum.MNU_PTH` FK는 그 잘못된 경로를 정상으로 인정한다. 따라서 다음 이중 검증을 필수로 한다.

- 관리자 화면 저장 시: `MNU_PTH` 형식(`/` 시작, 공백/외부 URL 금지)과 중복 여부 검증
- 배포/시드 검증 시: Nuxt route manifest 또는 `app/pages/**` 스캔 결과, `docs/screen-list.csv`, `TPRMPP_CMENUD`를 대조해 미존재 경로를 실패 처리
- 운영 중 신규 라우트 추가 시: 페이지 파일 추가 PR에 `cmenud` 등록 여부 체크리스트 포함

```
MNU_PTH        VARCHAR2(300)  PK   -- 메뉴경로 ('/budget/approval')
MNU_NM         VARCHAR2(100)  NN   -- 메뉴명 (참고 라벨, cmenum의 표시 라벨과는 별개)
MNU_GRP_C      VARCHAR2(40)        -- 메뉴그룹코드 ('BUDGET','INFO','ADMIN' 등 관리화면 분류)
USE_YN         VARCHAR2(1)    NN   -- 사용여부 (N이면 신규 메뉴 선택 불가)
RMK            VARCHAR2(300)       -- 비고

-- BaseEntity 공통 (자동 상속):
DEL_YN, GUID, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID

CHECK (USE_YN IN ('Y','N'))
```

### 3.2 `TPRMPP_CMENUM` — 공통메뉴기본 (메뉴 마스터)

`Cmenum` 엔티티, `BaseEntity` 상속 + `@EntityListeners(ChangeLogEntityListener.class)` (감사 로그 자동화).

```
MNU_ID         VARCHAR2(40)   PK            -- 메뉴ID ('MNU_INFO_BUDGET_APPROVAL' 등 안정 키)
HRK_MNU_ID     VARCHAR2(40)   FK→self       -- 상위메뉴ID (NULL=루트)
SRE_C          VARCHAR2(20)   NN            -- 화면코드 (info/audit/admin/board/documents/approval)
MNU_NM         VARCHAR2(100)  NN            -- 메뉴명 (표시 라벨)
MNU_TP         VARCHAR2(10)   NN            -- 메뉴타입 (LINK/GROUP/DYNAMIC)
MNU_PTH        VARCHAR2(300)  FK→CMENUD     -- 메뉴경로 (LINK일 때 필수, GROUP/DYNAMIC은 NULL)
FNT_C          VARCHAR2(40)                 -- 원천코드 (DYNAMIC, 예: 'BOARD_LIST')
IMG_C          VARCHAR2(40)                 -- 이미지코드 ('pi pi-wallet' 등 아이콘 식별자)
INFM_C         VARCHAR2(40)                 -- 알림코드 ('docReviewing','approvalPending' 등 배지 키)
MNU_SQN        NUMBER(5)      NN            -- 메뉴순서 (같은 부모 내, 10/20/30 간격)
HID_YN         VARCHAR2(1)    NN            -- 숨김여부 (Y=전체 숨김)
DEP_LEV        NUMBER(2)      NN            -- 깊이레벨 (1=루트, 2/3=하위)
HRK_PTH        VARCHAR2(500)  NN            -- 상위경로 (Materialized Path,
                                            --   '/MNU_INFO/MNU_INFO_BUDGET/MNU_INFO_BUDGET_APPROVAL')
VERSION        NUMBER         NN            -- @Version 낙관적 잠금

-- BaseEntity 공통 (자동 상속):
DEL_YN, GUID, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID

CHECK (MNU_TP IN ('LINK','GROUP','DYNAMIC'))
CHECK (HID_YN IN ('Y','N'))
CHECK (DEP_LEV BETWEEN 1 AND 3)
CHECK ((MNU_TP = 'LINK' AND MNU_PTH IS NOT NULL) OR MNU_TP <> 'LINK')
CHECK (
  (MNU_TP = 'LINK' AND MNU_PTH IS NOT NULL AND FNT_C IS NULL)
  OR (MNU_TP = 'GROUP' AND MNU_PTH IS NULL AND FNT_C IS NULL)
  OR (MNU_TP = 'DYNAMIC' AND MNU_PTH IS NULL AND FNT_C IS NOT NULL)
)
```

서비스 계층에서도 동일 검증을 수행한다. DB CHECK는 최종 방어선이며, 사용자에게는 `MNU_TP`별 필수/금지 필드 오류를 400 응답 메시지로 반환한다.

인덱스:
- `(SRE_C, HRK_MNU_ID, MNU_SQN)` — 화면별 사이드바 트리 조회
- `(MNU_PTH)` — Breadcrumb 역인덱스
- `(HRK_PTH)` — 후손 일괄 갱신 (`LIKE 'prefix%'`)

### 3.3 `TPRMPP_CMENUR` — 공통메뉴관계 (메뉴↔자격등급)

`Cmenur` 엔티티, `@IdClass(CmenurId.class)` 복합 PK.

```
MNU_ID         VARCHAR2(40)   PK,FK→CMENUM
ATH_ID         VARCHAR2(20)   PK            -- 자격등급ID (ITPAD001/ITPZZ001/ITPZZ002)

-- BaseEntity 공통 (자동 상속)

-- 규칙:
--   매핑 0건 = 모든 로그인 사용자 노출 (전체 공개)
--   매핑 1건 이상 = 해당 ROLE 보유자에게만 노출
```

삭제 정책은 프로젝트 공통 규약에 맞춰 물리 삭제가 아니라 Soft Delete를 기본으로 한다.

- `CMENUM` 메뉴 삭제 API는 실제로 `DEL_YN='Y'` 처리한다.
- `CMENUR` 관계도 `BaseEntity`를 상속하므로 메뉴 삭제 또는 권한 해제 시 `DEL_YN='Y'`로 정리한다.
- FK `ON DELETE CASCADE`는 사용하지 않는다. 물리 삭제가 금지되어 있고, Soft Delete에서는 cascade가 동작하지 않기 때문이다.
- 동일 `(MNU_ID, ATH_ID)` 권한을 재추가할 때는 기존 Soft Delete row를 복구하거나, DB 제약 조건을 고려해 중복 PK 충돌이 나지 않도록 서비스에서 처리한다.

권한 필터링 규칙:

- 부모 GROUP이 권한 필터로 제외되면 후손도 함께 제외한다.
- 부모는 통과했지만 필터 후 children이 0개가 된 GROUP/DYNAMIC 노드는 사용자용 `GET /api/menus` 응답에서 제거한다.
- 관리화면용 `GET /api/admin/menus`는 숨김/권한/빈 그룹 여부와 무관하게 전체 트리를 반환한다.

### 3.4 `TPRMPP_CMENUL` — 공통메뉴로그 (표준 로깅 방식)

**표준 로깅 패턴 준수** (it_backend/CLAUDE.md §5.12.1):

- `CmenumL` 엔티티가 `BaseLogEntity` 상속 → PK `LOG_HIS_TGR_SNO`, 변경구분 `CHG_DTT_YN`(C/U/D), `CHG_DTM`, `CHG_USID`, BaseEntity 스냅샷 6필드 자동 포함
- 마스터 `Cmenum`에 `@EntityListeners(ChangeLogEntityListener.class)` 부착 → JPA `@PrePersist`/`@PreUpdate` 시점에 `AuditLogPersister`가 자동 INSERT
- **별도의 `chg_tp`, `bf_json`, `af_json` 컬럼 불필요** — 스냅샷 방식(마스터 비즈니스 컬럼을 그대로 복제)
- 시퀀스 `SEQ_CMENUL` 등록 (`it_backend/src/main/resources/sql/audit_log_sequences_ddl.sql`)
- `ADMIN_LOG_TABLES`(`it_frontend/app/utils/adminLogs.ts`)에 추가: `{ key: 'cmenum', title: '메뉴 변경 로그', menuLabel: '메뉴 관리', tableName: 'TPRMPP_CMENUL' }`
- 관리자 로그 화면 `/admin/logs/cmenum`에서 자동 조회

```
-- BaseLogEntity 상속 (자동):
LOG_HIS_TGR_SNO  NUMBER(22)   PK   -- SEQ_CMENUL.NEXTVAL
CHG_DTT_YN       VARCHAR2(1)  NN   -- 변경구분 (C/U/D)
CHG_DTM          TIMESTAMP    NN   -- 변경일시
CHG_USID         VARCHAR2(14) NN   -- 변경자사번
DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID  -- 스냅샷

-- 마스터(CMENUM) 비즈니스 컬럼 복제 (스냅샷):
MNU_ID, HRK_MNU_ID, SRE_C, MNU_NM, MNU_TP, MNU_PTH, FNT_C,
IMG_C, INFM_C, MNU_SQN, HID_YN, DEP_LEV, HRK_PTH
```

주의: `CMENUR` 권한 관계 변경은 `CmenumL`에 자동 기록되지 않는다. 메뉴 권한 변경 이력이 감사 요구사항에 포함되면 `CmenurL` 로그 엔티티를 추가하거나, `Cmenum`의 변경일시를 함께 갱신해 권한 스냅샷을 별도 조회할 수 있게 해야 한다. 1단계 범위에서는 메뉴 마스터 변경 로그를 우선 구현하고, 권한 관계 로그 필요 여부는 보안/감사 검토 후 결정한다.

### 3.5 정합성 유지

- `HRK_PTH`/`DEP_LEV`는 **백엔드 `AdminMenuService` 계층에서 계산·저장** (트리거 사용 안 함, 디버깅·테스트 용이)
- 부모 이동 시 모든 후손의 `HRK_PTH` 일괄 갱신 (트랜잭션 내 재귀 update)
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
│   ├── AdminMenuService.java         -- HRK_PTH/DEP_LEV 재계산 책임
│   └── AdminRouteService.java
├── repository/ (Menu, MenuRole, MenuHistory, Route)
├── entity/    (Menu, MenuRole, MenuHistory, Route)
└── dto/       (MenuNodeDto, MenuTreeDto, MenuUpsertReq, ReorderReq, MoveReq)
```

### 4.2 엔드포인트

| Method | Path | 권한 | 용도 |
|---|---|---|---|
| GET | `/api/menus` | 인증사용자 | 전체 메뉴 트리 (사이드바·Breadcrumb 공용). 서버에서 ROLE 필터 + `HID_YN='N'` 필터 적용 |
| GET | `/api/admin/menus` | ADMIN | 관리화면용 전체 메뉴 (`HID_YN='Y'` 포함) |
| POST | `/api/admin/menus` | ADMIN | 단건 생성 |
| PUT | `/api/admin/menus/{mnuId}` | ADMIN | 단건 수정 (라벨·아이콘·경로·권한·HID_YN) |
| DELETE | `/api/admin/menus/{mnuId}` | ADMIN | 단건 Soft Delete (후손 존재 시 409) |
| PATCH | `/api/admin/menus/reorder` | ADMIN | 같은 부모 내 일괄 순서 변경 |
| PATCH | `/api/admin/menus/{mnuId}/move` | ADMIN | 부모 이동 + 후손 일괄 재계산 |
| GET | `/api/admin/menus/{mnuId}/history` | ADMIN | 변경 이력 |
| GET | `/api/admin/routes` | ADMIN | 라우트 카탈로그 (USE_YN='Y'만) |
| GET | `/api/admin/routes/all` | ADMIN | 라우트 카탈로그 전체 |
| POST/PUT/DELETE | `/api/admin/routes` | ADMIN | 라우트 CRUD |

삭제 API 의미:

- `DELETE /api/admin/menus/{mnuId}`는 물리 삭제가 아니라 `DEL_YN='Y'` Soft Delete다.
- 후손이 존재하는 메뉴는 삭제 대신 409를 반환한다. 후손까지 일괄 숨김이 필요한 경우 별도 `PATCH /api/admin/menus/{mnuId}/hide-subtree` 도입을 검토한다.
- `DELETE /api/admin/routes`는 이미 메뉴에서 참조 중인 경로이면 409를 반환하고, 미참조 경로만 Soft Delete 처리한다.
- `/admin/menus`와 `/admin/routes` 페이지 자체는 DB 메뉴 노출 설정과 무관하게 `middleware/admin` + 백엔드 `@PreAuthorize`로 접근 가능해야 한다. 관리자가 실수로 메뉴 관리 메뉴를 숨겨도 직접 URL 접근으로 복구할 수 있는 break-glass 경로다.

### 4.3 보안

- 모든 `Admin*Controller`는 **클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")`** (CLAUDE.md §4.4.1 이중 보호)
- `GET /api/menus`는 인증만 요구하되 서버에서 `cmenur` 매핑과 `authUser.athIds` 교집합으로 필터
- 프론트는 받은 트리를 그대로 렌더 → 권한 판단 책임 서버 일원화
- 동적 메뉴도 동일 원칙을 따른다. `BOARD_LIST` children은 프론트에서 전체 게시판을 받아 필터링하지 않고, 백엔드가 현재 사용자 기준으로 조회 가능한 게시판만 children으로 주입해 응답한다.

### 4.4 캐싱 (1단계에서는 도입 안 함)

- 메뉴 트리 규모(약 70행) + `(SRE_C, HRK_MNU_ID, MNU_SQN)` 인덱스로 직접 쿼리도 ms 단위
- JPA 영속성 컨텍스트 + Oracle SGA가 사실상 캐시 역할 수행
- `@Cacheable` 도입 시 `@CacheEvict` 누락 위험 — 메뉴 수정이 사이드바에 반영되지 않는 종류의 버그가 발생하면 본 기능의 핵심 가치(즉시 반영)가 훼손됨
- 단일 WAR 가정으로 Caffeine은 가능하나 다중 인스턴스 확장 시 비동기화 문제 → 결국 Redis 도입 필요
- **운영 후 측정 (`/api/menus` p95 응답시간):**
  - p95 < 200ms → 캐시 불필요, 현 상태 유지
  - p95 ≥ 200ms 또는 DB 부하 체감 → Caffeine 도입 (단일 WAR 한정) 또는 Redis 검토 — TASK.md 등록
- 측정 수단: Spring Actuator `/actuator/metrics/http.server.requests` 또는 `@Timed` 어노테이션

### 4.5 핵심 서비스 로직 — `AdminMenuService.move(...)`

1. 대상 노드 + 모든 후손 SELECT (`WHERE HRK_PTH LIKE '/oldPath/%'`)
2. 새 parent의 `HRK_PTH`·`DEP_LEV` 기준으로 본인 갱신
3. 후손들의 `HRK_PTH`는 `replace(oldPrefix, newPrefix)`, `DEP_LEV`는 차이만큼 가감
4. **로그(`cmenul`)는 별도 INSERT 불필요** — `@EntityListeners(ChangeLogEntityListener.class)`가 `@PreUpdate`에서 자동 처리 (it_backend/CLAUDE.md §5.12.1)
5. depth 3 초과 또는 순환 참조 → `IllegalArgumentException` → 400
6. 사용자용 메뉴 응답은 DB 재조회로 즉시 반영된다. 향후 서버 캐시를 도입한 경우에만 캐시 evict를 추가한다.

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
  - `nodeById: Map<string, MenuNode>` — `HRK_PTH` split 매핑
- 동적 메뉴 해석:
  - `MNU_TP='DYNAMIC' && FNT_C='BOARD_LIST'` 노드는 백엔드 응답에 이미 권한 필터링된 children이 포함된다.
  - 프론트는 동적 소스별 추가 API를 호출하지 않는다. 새 `FNT_C` 추가 시 백엔드 `MenuQueryService`의 dynamic resolver 매핑을 추가한다.
- 캐시 무효화: `/admin/menus` 저장 후 `refresh()` 호출 → 사이드바·Breadcrumb 즉시 반영

### 5.3 `AppSidebar.vue` 리팩토링

- `menuItems = computed(...)` 거대 블록(약 145행) **전체 삭제**
- 데이터 소스: `const { treeByContext } = useMenu(); const menuItems = computed(() => treeByContext.value[context.value] ?? []);`
- 동적 메뉴 children 주입은 `useMenu` 내부에서 처리 → 사이드바는 소스 무관
- 배지(`INFM_C`)·아이콘(`IMG_C`)·관리자 표시는 노드 필드에서 직접 읽음
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
  const current = nodeByPath.value.get(route.fullPath) ?? nodeByPath.value.get(route.path);
  if (!current) return [];
  return current.hrkPth.split('/').filter(Boolean).map(id => {
    const node = nodeById.value.get(id);
    return {
      label: node?.mnuNm ?? id,
      route: node?.mnuTp === 'LINK' ? node.mnuPth : undefined,
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
- `MNU_PTH`는 query string 포함 경로를 허용한다. `/approval/list?tab=pending`처럼 같은 path에 여러 메뉴가 걸린 경우 breadcrumb는 `route.fullPath`를 우선 사용하고, 일치 항목이 없을 때만 `route.path`로 fallback한다.

### 5.5 관리화면 `/admin/menus`

- **좌측:** PrimeVue `Tree` (drag&drop 활성화)
- **우측 편집 폼:** `MNU_NM`, `IMG_C`, `MNU_TP`, `MNU_PTH`(Dropdown ← `/api/admin/routes`), `INFM_C`, `HID_YN`, 역할 체크박스
- **상단 액션:** [신규] [이력] [삭제]
- 드래그&드롭 부모 변경 → `move` API
- 같은 부모 내 순서 변경 → `reorder` API 일괄 호출
- 저장 후 `useMenu().refresh()`

### 5.6 관리화면 `/admin/routes`

- `StyledDataTable`로 라우트 카탈로그 관리
- `useAdminTableEdit` 컴포저블과 함께 사용 (CLAUDE.md §4.9)
- 컬럼: `MNU_PTH`, `MNU_NM`, `MNU_GRP_C`, `USE_YN`, `RMK`, BaseEntity 공통

### 5.7 미들웨어/라우트 가드

- 기존 `middleware/admin.ts` 유지 (서버 권한이 최종 보안 경계)
- 라우트 자체의 권한 제어는 변하지 않음 — DB는 "메뉴 노출 여부"만 책임
- `/admin/menus`·`/admin/routes` 페이지는 `definePageMeta({ middleware: 'admin', layout: 'admin' })`

### 5.8 메뉴 관리 메뉴 자체

- `cmenum` 시드에 `MNU_ADMIN_MENUS`, `MNU_ADMIN_ROUTES` 추가
- `cmenur`에 `ITPAD001` 매핑만 추가 → 일반 사용자에게 비노출
- 사이드바 `admin` 컨텍스트의 "데이터 관리" 그룹 하위에 배치

## 6. 마이그레이션

Flyway 파일 3개 (CLAUDE.md §4.4 명명 규칙 준수).

### 6.1 `V20260530_001__CreateMenuTables.sql`

- `TPRMPP_CMENUD`, `TPRMPP_CMENUM`, `TPRMPP_CMENUR`, `TPRMPP_CMENUL` 테이블 + 인덱스 + FK + CHECK 제약
- 시퀀스: `SEQ_CMENUL` (BaseLogEntity PK 채번용, `audit_log_sequences_ddl.sql`에 추가)

### 6.2 `V20260530_002__SeedRouteCatalog.sql`

- 현재 `AppSidebar.vue`에서 사용 중인 모든 `to` 경로 약 60건 `TPRMPP_CMENUD`에 INSERT
- `MNU_GRP_C`는 경로 prefix 기반 분류
- `USE_YN='Y'`로 일괄 등록

### 6.3 `V20260530_003__SeedMenuTree.sql`

- `AppSidebar.vue`의 모든 `menuItems` 노드를 `TPRMPP_CMENUM`에 INSERT
- `HRK_PTH`·`DEP_LEV` 명시 계산 후 저장
- `TPRMPP_CMENUR` 매핑: `admin: true` → `ITPAD001` 1행, 그 외 → 매핑 0건(전체 공개)
- 동적 메뉴: `BOARD_LIST` 노드 1건 (`MNU_TP='DYNAMIC'`, `FNT_C='BOARD_LIST'`)
- 관리 메뉴 자체 노드(`MNU_ADMIN_MENUS`, `MNU_ADMIN_ROUTES`) 포함

### 6.4 시드 정확성 검증 (필수)

배포 직후 다음 검증 스크립트 실행:

- `GET /api/menus` (ROLE=ADMIN)의 응답 트리를 현재 하드코딩 메뉴와 비교
- 라벨·순서·아이콘·경로·권한·배지 모두 일치 확인
- `TPRMPP_CMENUD.MNU_PTH`를 Nuxt 실제 라우트 목록 및 `docs/screen-list.csv`와 대조해 미존재 경로가 있으면 실패 처리
- query string 포함 메뉴는 `fullPath` 기준으로 비교하고, query 없는 상세/동적 라우트는 path 패턴 기준으로 비교
- 불일치 항목이 있으면 hotfix 마이그레이션(`V20260530_004__...`)으로 즉시 보정
- 검증 스크립트는 `it_database/scripts/verify-menu-seed.ts` 등으로 보관

## 7. 롤아웃 전략 — 단일 배포

백엔드 + 프론트 + 시드를 **한 번에 배포**한다.

- 시드와 현재 코드 메뉴가 1:1 일치하므로 사용자 체감 변화 없음
- 첫 효과: 관리자가 4월 IT감사팀 같은 케이스를 코드 수정 없이 처리 가능

### 7.1 배포 직후 검증 (강화)

- 마이그레이션 적용 직후 §6.4 검증 스크립트 실행
- 운영 사용자 일부(관리자 본인 + 1팀)로 사이드바·Breadcrumb·관리화면 스모크 테스트
- `/admin/menus`에서 라벨 변경 → 다른 브라우저 세션에서 사이드바 새로고침 시 즉시 반영 확인

### 7.2 롤백

- 프론트 문제: 직전 커밋으로 revert → DB는 잔존(영향 없음)
- 백엔드 문제: API 비활성화 또는 직전 WAR 배포, 테이블은 잔존
- 시드 문제: hotfix 마이그레이션으로 보정 (downgrade 안 함)

## 8. 테스트 계획

| 레이어 | 도구 | 대상 |
|---|---|---|
| Backend Unit | JUnit | `AdminMenuService.move()` — `HRK_PTH` 후손 일괄 갱신, depth 제한, 순환 방지 |
| Backend Unit | JUnit | `AdminMenuService.delete()` — 후손 존재 시 409 |
| Backend Unit | JUnit | `AdminMenuService.reorder()` — 같은 부모 내 `MNU_SQN` 일괄 갱신 |
| Backend Integration | `@SpringBootTest` | `/api/menus` 권한 필터링 (ADMIN vs USER 응답 비교) |
| Backend Integration | `@SpringBootTest` | `/api/menus` 동적 `BOARD_LIST` children 서버 권한 필터링 |
| Backend Integration | `@SpringBootTest` | `/api/admin/menus` `@PreAuthorize` — 비관리자 403 |
| Backend Integration | `@SpringBootTest` | `TPRMPP_CMENUM.MNU_PTH` FK — `TPRMPP_CMENUD`에 없는 경로 저장 시 제약 위반 |
| Backend Integration | `@SpringBootTest` | `CmenumL` 자동 INSERT — `Cmenum` UPDATE 시 `TPRMPP_CMENUL`에 스냅샷 1건 적재 (`CHG_DTT_YN='U'`) |
| Backend Integration | `@SpringBootTest` | Soft Delete 후 `CMENUR` 관계 필터링 및 권한 재추가 복구 |
| Frontend Unit | Vitest | `useMenu` — treeByContext 변환, nodeByPath 인덱스, 서버가 내려준 동적 children 렌더링 |
| Frontend Unit | Vitest | `AppBreadcrumb` — `HRK_PTH` split → items 변환, LINK/GROUP 구분, fullPath/query fallback |
| Frontend E2E | Playwright | 관리자가 메뉴 숨김 토글 → 사이드바 즉시 반영 (4월 이슈 회귀 방지) |
| Frontend E2E | Playwright | 일반 사용자에게 admin 전용 메뉴 미노출 |

## 9. 리스크 및 완화책

| 리스크 | 완화책 |
|---|---|
| 시드와 코드 메뉴 불일치로 운영 후 메뉴 누락 | §6.4 검증 스크립트 자동화, 배포 직후 필수 실행 |
| 라우트 카탈로그에 미존재 Nuxt 경로 등록 | 관리자 저장 검증 + 배포 검증 스크립트에서 route manifest/screen-list 대조 |
| 관리자가 본인을 모든 메뉴에서 제외 후 자기 잠금 | `/admin/menus` 자체는 직접 URL + `middleware/admin`으로 항상 접근 가능 — DB 메뉴 노출 설정과 무관 |
| Soft Delete 관계 row가 남아 권한 필터가 오동작 | 모든 조회에서 `DEL_YN='N'` 필터 강제, 권한 재추가 시 기존 row 복구 정책 구현 |
| 부모/자식 권한 불일치로 빈 그룹 노출 | 사용자용 트리 생성 시 권한 없는 부모 하위 제거, children 0개 GROUP/DYNAMIC 제거 |
| 동시 편집으로 `HRK_PTH` 충돌 | `cmenum`에 `@Version` 낙관적 잠금, 충돌 시 409 + 사용자에게 재시도 안내 |
| 테이블 후미 `D`/`R` 표준 외 사용 | CLAUDE.md §5.2 보강 PR로 후미 규칙 확장 등록 |
| 메뉴 조회 부하가 예상보다 클 가능성 | 운영 후 p95 측정. 임계 초과 시에만 캐시 도입(§4.4) — 선제 도입은 캐시 무효화 버그 위험이 더 큼 |
| 신규 페이지 추가 시 `cmenud` 등록 누락 | 루트 `CLAUDE.md` §4에 체크리스트 명시, PR 템플릿에 항목 추가 |
| DYNAMIC 메뉴 소스 추가 시 코드 변경 필요 | `BOARD_LIST` 외 동적 소스가 늘어나면 백엔드 dynamic resolver 매핑 테이블 분리 — 현재는 YAGNI |

## 10. 문서 업데이트

- `it_backend/CLAUDE.md` §5.2: 테이블 후미 `D`(명세)·`R`(관계) 규칙 추가, `menu` 패키지 설명 추가
- `it_backend/CLAUDE.md` §5.12.1: 감사 로그 적용 엔티티 23개 → 24개(`CmenumL` 추가)
- `it_frontend/CLAUDE.md` §4.6: `pages/admin/menus`, `pages/admin/routes` 추가
- 루트 `CLAUDE.md` §4: **신규 페이지 추가 시 `cmenud` 등록 필수** 워크플로우 명시
- `TASK.md`: 테이블 후미 규칙 확장(D/R), `/api/menus` 응답시간 측정 후 캐시 도입 검토, DYNAMIC 원천 분리

## 11. 향후 과제 (이 설계 범위 밖)

- 메뉴별 통계(클릭 수, 마지막 접근 시각) — 사용 빈도 기반 정렬 추천
- 사용자별 즐겨찾기 메뉴
- 다국어 라벨 (`MNU_NM_EN` 컬럼 등)
- DYNAMIC 메뉴 소스 카탈로그(현재는 백엔드 `MenuQueryService` resolver 매핑)
