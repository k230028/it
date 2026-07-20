# 메뉴 관리 기능 설계

- **작성일:** 2026-05-30
- **작성자:** gonnabe88@gmail.com (with Claude)
- **상태:** Draft — 사용자 검토 대기
- **개정:** 2026-06-03 — 메타 표준(meta.csv) 준수 재설계. 등재 표준용어만 사용(신규 등재 0건), 미등재 개념(아이콘·배지·동적원천)은 `MNU_ID` 기준 코드 규약으로 이관(§3.0/§3.6). `IMG_C`·`INFM_C`·`FNT_C` 컬럼 제거.
- **관련 이슈:** 2026-04 IT감사팀 메뉴 임시 숨김 처리에 코드 수정 + 빌드 + 배포로 2일 소요

---

## 1. 배경 및 목적

현재 사이드바 메뉴는 [`it_frontend/app/components/AppSidebar.vue`](../../../it_frontend/app/components/AppSidebar.vue) `menuItems` computed(약 145행)에 **하드코딩**되어 있다. 6개 컨텍스트(`info`, `audit`, `admin`, `board`, `documents`, `approval`)별 트리가 라우트 경로 분기로 표시된다.

이로 인해 다음 운영 부담이 발생한다.

- 메뉴 라벨 변경·임시 숨김·순서 조정 모두 **코드 수정 + 빌드 + 배포**가 필요
- 2026-04 IT감사팀 메뉴 임시 숨김 처리에 2일 소요(실 작업은 1줄 변경)
- 변경 이력 추적 불가 (Git diff에 의존)

**목표:** 시스템관리자(ITPAD001)가 코드 수정 없이 사이드바 메뉴의 **순서·라벨·노출 권한·숨김 여부**를 즉시 변경할 수 있게 한다. 또한 메뉴 계층 정보를 활용한 **Breadcrumb**를 헤더 영역에 제공한다.

> 아이콘은 meta 표준 미등재 개념이라 DB 컬럼이 아니며(§3.0/§3.6), 저빈도 디자인 결정이므로 프론트 규약 맵으로 관리한다(변경 시 프론트 배포). 2026-04 IT감사팀 사례의 실제 부담이었던 숨김·라벨·순서·권한은 모두 즉시 DB 편집 대상이다.

## 2. 결정사항 요약

| 항목 | 결정 |
|---|---|
| 관리 범위 | **완전 DB화** — 메뉴 트리 전체를 DB로 관리 |
| 화면 영역 모델 | **단일 테이블 + `SRE_TC` 컬럼** (`01`=info, `02`=audit, `03`=admin, `04`=board, `05`=documents, `06`=approval) |
| 권한 모델 | **권한(ROLE) 다중 연결 테이블** (`cmenua` / `TPRMPP_CMENUA`) |
| 동적 메뉴 처리 | **`MNU_TP_C='DYN'` 노드**로 등록(별도 원천 컬럼 없음), 서버가 `MNU_ID` 기준 resolver로 권한 필터링된 children 주입 |
| 아이콘·배지·동적원천 | **DB 컬럼 아님** — meta 미등재 개념이므로 `MNU_ID` 기준 코드 규약으로 처리(§3.6) |
| 편집 범위 | **신설/숨김 가능**, 단 경로는 **검증된 DB 라우트 카탈로그(`cmenud`)에서 선택만** |
| 라우트 카탈로그 | **DB 테이블 `cmenud` / `TPRMPP_CMENUD`로 관리**, FK + 라우트 검증 스크립트로 dead link 방지 |
| 계층 표현 | `HRK_MNU_ID` + Materialized Path(`WHL_MNU_PTH`) + `MNU_DEP` 이중 보유 |
| 변경 로그 | **`BaseLogEntity` 상속 (`CmenumL`/`TPRMPP_CMENUL`)** — `ChangeLogEntityListener` 자동 적재, 스냅샷 방식 |
| Breadcrumb | PrimeVue `Breadcrumb` 컴포넌트 사용, `useMenu` 캐시 공유 |
| 권한 필터링 | **서버 단 일원화** (`GET /api/menus` 응답에 ROLE 필터 적용) |
| 캐시 | **도입하지 않음** — 70행 규모 + 인덱스로 충분, 측정 후 필요 시 TASK 백로그에서 검토 |
| 깊이 제한 | **3단** (현재 `adminLogMenuGroups`가 3단 사용) |
| 롤아웃 | **단일 배포** (백엔드+프론트+시드 동시), 마이그레이션 직후 데이터 검증 강화 |

## 3. 데이터 모델

### 3.0 명명 규약 검증

**준수 기준 (확정): 물리명은 `meta.csv`에 행으로 등재된 표준용어만 사용한다. 신규 등재 0건.** 등재 용어가 없는 개념은 메뉴 테이블 컬럼으로 만들지 않고 `MNU_ID` 기준 코드측 규약으로 처리한다(§3.6).

테이블·컬럼명은 `meta.csv`(표준용어 75,914건 전수 조사), `it_backend/CLAUDE.md` §5.2(테이블 명칭), §5.12.1(BaseLogEntity 로깅 패턴), `it_backend/docs/guides/data-model.md` §1(마스터/로그/연결 테이블 후미)을 기준으로 점검했다.

> 주의: 루트 가이드에는 `META.md`/`DOMAIN.md` 포인터가 남아 있으나 현재 저장소 루트에는 해당 파일이 없고, 실제 사전 파일은 `C:\it\meta.csv`다. 따라서 본 설계의 물리명 검증 기준은 `meta.csv`로 둔다.

**확인된 표준 물리명** (`meta.csv` 등재 — 본 설계에서 사용하는 컬럼은 전부 등재 확인됨):
- 메뉴: `MNU_ID`(메뉴ID, VARCHAR2(10)), `MNU_NM`(메뉴명, VARCHAR2(100)), `MNU_PTH`(메뉴경로, VARCHAR2(200)), `MNU_TP_C`(메뉴유형코드, VARCHAR2(3)), `MNU_SOT_SQN_SNO`(메뉴정렬순서일련번호, NUMBER(9)), `MNU_PRO_SQN_SNO`(메뉴출력순서일련번호, NUMBER(9)), `MNU_DEP`(메뉴깊이, NUMBER(3)), `HRK_MNU_ID`(상위메뉴ID, VARCHAR2(10)), `WHL_MNU_PTH`(전체메뉴경로, VARCHAR2(500))
- 화면/라우트: `SRE_ID`(화면ID, VARCHAR2(10)), `SRE_PTH`(화면경로, VARCHAR2(300)), `SRE_MNU_NM`(화면메뉴명, VARCHAR2(100)), `SRE_NM`(화면명, VARCHAR2(100)), `SRE_TC`(화면구분코드, VARCHAR2(2)), `SRE_USE_YN`(화면사용여부, VARCHAR2(1))
- 공통/권한/로그: `ATH_ID`(권한ID, VARCHAR2(32)), `HID_YN`(숨김여부, VARCHAR2(1)), `USE_YN`(사용여부, VARCHAR2(1)), `DEL_YN`(삭제여부, VARCHAR2(1)), `RMK`(비고, VARCHAR2(300)), `GUID`(VARCHAR2(38)), `LOG_HIS_TGR_SNO`(로그이력전문일련번호, NUMBER(18)), `CHG_DTT_YN`(변경구분여부, VARCHAR2(1)), `CHG_DTM`, `CHG_USID`

**미등재로 인해 DB 컬럼에서 제외한 개념** (전수 조사로 등재 용어 부재 확인 → §3.6 코드 규약으로 이관):
- **아이콘**: PrimeVue icon class(`pi pi-wallet`). `meta.csv`에 `아이콘`/`이미지코드` 표준어 없음(`IMG_PTH`(이미지경로), `IMG_SZ_TC`(이미지크기구분코드)만 존재 — 아이콘 클래스 문자열과 의미 불일치). 기존 초안의 `IMG_C` **제거**.
- **배지**: 알림 카운트 resolver key(`approvalPending` 등). 표준 `INFM_*`는 모두 도메인 접두 복합어(예: `LGN_INFM_TC`)이며 단독 `INFM_C` 미등재. 기존 초안의 `INFM_C` **제거**.
- **동적원천**: DYN 메뉴 데이터 원천(`BOARD_LIST`). 단독 `FNT_C`/`FNT_TC` 미등재. 기존 초안의 `FNT_C` **제거**.

> 위 3개는 본래 코드 종속 값이다. 배지 key는 특정 composable import에, DYN 원천은 특정 백엔드 resolver에 1:1로 묶여 있어 **관리자 화면에서 코드 변경 없이 추가·편집할 수 없었다.** 따라서 DB 컬럼은 실효 없는 허구였으며, `MNU_ID` 기준 코드 규약 매핑(§3.6)이 정확한 모델이다. 본 변경으로 마이그레이션의 메타 거버넌스 승인 대기 의존성이 완전히 제거된다.

**전 컬럼 메타 준수 재점검 결과** (2026-06-03, `meta.csv` 직접 대조 — 4개 테이블 전 컬럼):

| 물리명 | meta 논리명 / 타입 | 사용 테이블 | 준수 |
|---|---|---|---|
| `MNU_ID` | 메뉴ID / VARCHAR2(10) | CMENUM·CMENUA·CMENUL | ✅ |
| `MNU_NM` | 메뉴명 / VARCHAR2(100) | CMENUM·CMENUL | ✅ |
| `MNU_TP_C` | 메뉴유형코드 / VARCHAR2(3) | CMENUM·CMENUL | ✅ |
| `MNU_SOT_SQN_SNO` | 메뉴정렬순서일련번호 / NUMBER(9) | CMENUM·CMENUL | ✅ |
| `MNU_DEP` | 메뉴깊이 / NUMBER(3) | CMENUM·CMENUL | ✅ |
| `HRK_MNU_ID` | 상위메뉴ID / VARCHAR2(10) | CMENUM·CMENUL | ✅ |
| `WHL_MNU_PTH` | 전체메뉴경로 / VARCHAR2(500) | CMENUM·CMENUL | ✅ |
| `SRE_PTH` | 화면경로 / VARCHAR2(300) | CMENUD(PK)·CMENUM·CMENUL | ✅ |
| `SRE_MNU_NM` | 화면메뉴명 / VARCHAR2(100) | CMENUD | ✅ |
| `SRE_TC` | 화면구분코드 / VARCHAR2(2) | CMENUD·CMENUM·CMENUL | ✅ |
| `ATH_ID` | 권한ID / VARCHAR2(32) | CMENUA | ✅ |
| `HID_YN` | 숨김여부 / VARCHAR2(1) | CMENUM·CMENUL | ✅ |
| `USE_YN` | 사용여부 / VARCHAR2(1) | CMENUD | ✅ |
| `RMK` | 비고 / VARCHAR2(300) | CMENUD | ✅ |
| `DEL_YN` | 삭제여부 / VARCHAR2(1) | 전 테이블(BaseEntity) | ✅ |
| `GUID` | GUID / VARCHAR2(38) | 전 테이블(BaseEntity) | ✅ |
| `GUID_PRG_SNO` | GUID진행일련번호 / NUMBER(4) | CMENUL(BaseLogEntity) | ✅ |
| `FST_ENR_DTM` | 최초등록일시 / DATE | 전 테이블(BaseEntity) | ✅ |
| `FST_ENR_USID` | 최초등록사용자ID / VARCHAR2(14) | 전 테이블(BaseEntity) | ✅ |
| `LST_CHG_DTM` | 최종변경일시 / DATE | 전 테이블(BaseEntity) | ✅ |
| `LST_CHG_USID` | 최종변경사용자ID / VARCHAR2(14) | 전 테이블(BaseEntity) | ✅ |
| `LOG_HIS_TGR_SNO` | 로그이력전문일련번호 / NUMBER(18) | CMENUL(PK) | ✅ |
| `CHG_DTT_YN` | 변경구분여부 / VARCHAR2(1) | CMENUL | ✅ |
| `CHG_DTM` | 변경일시 / DATE | CMENUL | ✅ |
| `CHG_USID` | 변경사용자ID / VARCHAR2(14) | CMENUL | ✅ |
| ~~`VERSION`~~ | **미등재** | (구 CMENUM) | ❌ **제거** |

> `VERSION`은 `meta.csv` 미등재이며, 현재 백엔드에 `@Version` 사용처가 전무하고 `BaseEntity`에도 버전 컬럼이 없다(낙관적 잠금은 프로젝트 관례가 아님). 따라서 메타 준수 + 기존 관례 일치를 위해 **`VERSION` 컬럼과 `@Version` 낙관적 잠금을 제거**한다. 메뉴 편집은 관리자 전용·저빈도이므로 last-write-wins로 충분하며, 향후 필요 시 등재 카운터로 재도입한다(§9). `CHG_USID`의 메타 논리명은 "변경사용자ID"이므로 본문 주석의 "변경자사번" 표현은 물리명 기준으로는 동일하다.

**테이블 명명 구조** (`it_backend/CLAUDE.md` §5.2): `TPRMPP_{1자리 구분}{4자리 도메인}{1자리 용도}` — 구분 `C`(공통)/`B`(비즈니스). 본 설계 4개 테이블은 모두 `C`(공통) + `MENU`(도메인) + 용도 1자리로 구성된다.

**테이블 후미(용도) 적용:**
- 마스터: `*M` → `CMENUM`(메뉴 마스터)
- 상세: `*D` → `CMENUD`(화면/라우트 상세 — 메뉴 도메인의 화면 상세 카탈로그)
- 연결/매핑: `*A` → `CMENUA`(메뉴↔권한). `it_backend/docs/guides/data-model.md`의 `CAPPLA`, `BPROJA` 패턴
- 로그: `*L` → `CMENUL`(변경 로그)

> 용도 `D`(상세)는 백엔드 §5.2의 문서화된 목록(M/L/H)에는 없으나, 실제 운영에서 쓰이는 `A`(연결)와 동일하게 `TPRMPP_{구분}{도메인}{용도}` 구조를 그대로 따른다. 라우트 카탈로그는 메뉴 도메인에 종속된 화면 상세 테이블이므로 `CMENUD`로 둔다. (백엔드 §5.2 용도 목록에 `D`(상세)·`A`(연결) 추가 반영은 §10 문서 업데이트 대상)

**테이블 매핑:**
| 엔티티 | 테이블 | 역할 |
|---|---|---|
| `cmenud` | `TPRMPP_CMENUD` | 공통화면상세 — 라우트 카탈로그 |
| `cmenum` | `TPRMPP_CMENUM` | 공통메뉴기본 — 메뉴 마스터 |
| `cmenua` | `TPRMPP_CMENUA` | 공통메뉴권한연결 — 메뉴↔권한 |
| `cmenul` | `TPRMPP_CMENUL` | 공통메뉴로그 — 변경 스냅샷 (BaseLogEntity 상속) |

### 3.1 `TPRMPP_CMENUD` — 공통화면상세 (라우트 카탈로그)

`Cmenud` 엔티티, `BaseEntity` 상속.

라우트 카탈로그는 FK 대상이지만, FK만으로 실제 Nuxt 라우트 존재 여부를 보장할 수 없다. 운영자가 존재하지 않는 경로를 `cmenud`에 등록하면 이후 `cmenum.SRE_PTH` FK는 그 잘못된 경로를 정상으로 인정한다. 따라서 다음 이중 검증을 필수로 한다.

- 관리자 화면 저장 시: `SRE_PTH` 형식(`/` 시작, 공백/외부 URL 금지)과 중복 여부 검증
- 배포/시드 검증 시: Nuxt route manifest 또는 `app/pages/**` 스캔 결과, `docs/screen-list.csv`, `TPRMPP_CMENUD`을 대조해 미존재 경로를 실패 처리
- 운영 중 신규 라우트 추가 시: 페이지 파일 추가 PR에 `cmenud` 등록 여부 체크리스트 포함

```
SRE_PTH        VARCHAR2(300)  PK   -- 화면경로 ('/budget/approval')
SRE_MNU_NM     VARCHAR2(100)  NN   -- 화면메뉴명 (참고 라벨, cmenum의 표시 라벨과는 별개)
SRE_TC         VARCHAR2(2)          -- 화면구분코드 ('01'=info,'02'=audit,'03'=admin 등)
USE_YN         VARCHAR2(1)    NN   -- 사용여부 (N이면 신규 메뉴 선택 불가)
RMK            VARCHAR2(300)       -- 비고

-- BaseEntity 공통 (자동 상속):
DEL_YN, GUID, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID

CHECK (USE_YN IN ('Y','N'))
```

### 3.2 `TPRMPP_CMENUM` — 공통메뉴기본 (메뉴 마스터)

`Cmenum` 엔티티, `BaseEntity` 상속 + `@EntityListeners(ChangeLogEntityListener.class)` (감사 로그 자동화).

```
MNU_ID         VARCHAR2(10)   PK            -- 메뉴ID ('MINF0001' 등 meta 표준 길이 10자 이내 안정 키)
HRK_MNU_ID     VARCHAR2(10)   FK→self       -- 상위메뉴ID (NULL=루트)
SRE_TC         VARCHAR2(2)    NN            -- 화면구분코드 ('01'=info,'02'=audit,'03'=admin,'04'=board,'05'=documents,'06'=approval)
MNU_NM         VARCHAR2(100)  NN            -- 메뉴명 (표시 라벨)
MNU_TP_C       VARCHAR2(3)    NN            -- 메뉴유형코드 (LNK/GRP/DYN)
SRE_PTH        VARCHAR2(300)  FK→CMENUD      -- 화면경로 (LNK일 때 필수, GRP/DYN은 NULL)
MNU_SOT_SQN_SNO NUMBER(9)     NN            -- 메뉴정렬순서일련번호 (같은 부모 내, 10/20/30 간격)
HID_YN         VARCHAR2(1)    NN            -- 숨김여부 (Y=전체 숨김)
MNU_DEP        NUMBER(3)      NN            -- 메뉴깊이 (1=루트, 2/3=하위)
WHL_MNU_PTH    VARCHAR2(500)  NN            -- 전체메뉴경로 (Materialized Path,
                                            --   '/MINF0001/MINF0010/MINF0011')

-- VERSION(@Version) 컬럼 없음 — meta 미등재 + 백엔드 @Version 미사용 관례. 낙관적 잠금 미적용(§3.0/§9)
-- 아이콘/배지/동적원천 컬럼 없음 — meta 미등재 개념이므로 MNU_ID 기준 코드 규약(§3.6)으로 처리

-- BaseEntity 공통 (자동 상속):
DEL_YN, GUID, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID

CHECK (MNU_TP_C IN ('LNK','GRP','DYN'))
CHECK (HID_YN IN ('Y','N'))
CHECK (MNU_DEP BETWEEN 1 AND 3)
CHECK (
  (MNU_TP_C = 'LNK' AND SRE_PTH IS NOT NULL)
  OR (MNU_TP_C IN ('GRP','DYN') AND SRE_PTH IS NULL)
)
```

`MNU_TP_C` 단독으로 LNK/GRP/DYN을 구분한다(원천 컬럼 제거). DYN 노드의 children 생성 책임은 백엔드 resolver가 `MNU_ID`로 식별한다(§3.6). 서비스 계층에서도 동일 검증을 수행한다. DB CHECK는 최종 방어선이며, 사용자에게는 `MNU_TP_C`별 필수/금지 필드 오류를 400 응답 메시지로 반환한다.

인덱스:
- `(SRE_TC, HRK_MNU_ID, MNU_SOT_SQN_SNO)` — 화면별 사이드바 트리 조회
- `(SRE_PTH)` — Breadcrumb 역인덱스
- `(WHL_MNU_PTH)` — 후손 일괄 갱신 (`LIKE 'prefix%'`)

### 3.3 `TPRMPP_CMENUA` — 공통메뉴권한연결 (메뉴↔권한)

`Cmenua` 엔티티, `@IdClass(CmenuaId.class)` 복합 PK.

```
MNU_ID         VARCHAR2(10)   PK,FK→CMENUM
ATH_ID         VARCHAR2(32)   PK            -- 권한ID (ITPAD001/ITPZZ001/ITPZZ002)

-- BaseEntity 공통 (자동 상속)

-- 규칙:
--   매핑 0건 = 모든 로그인 사용자 노출 (전체 공개)
--   매핑 1건 이상 = 해당 권한 보유자에게만 노출
```

삭제 정책은 프로젝트 공통 규약에 맞춰 물리 삭제가 아니라 Soft Delete를 기본으로 한다.

- `CMENUM` 메뉴 삭제 API는 실제로 `DEL_YN='Y'` 처리한다.
- `CMENUA` 관계도 `BaseEntity`를 상속하므로 메뉴 삭제 또는 권한 해제 시 `DEL_YN='Y'`로 정리한다.
- FK `ON DELETE CASCADE`는 사용하지 않는다. 물리 삭제가 금지되어 있고, Soft Delete에서는 cascade가 동작하지 않기 때문이다.
- 동일 `(MNU_ID, ATH_ID)` 권한을 재추가할 때는 기존 Soft Delete row를 복구하거나, DB 제약 조건을 고려해 중복 PK 충돌이 나지 않도록 서비스에서 처리한다.

권한 필터링 규칙:

- 부모 GRP가 권한 필터로 제외되면 후손도 함께 제외한다.
- 부모는 통과했지만 필터 후 children이 0개가 된 GRP/DYN 노드는 사용자용 `GET /api/menus` 응답에서 제거한다.
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
LOG_HIS_TGR_SNO  NUMBER(18)   PK   -- SEQ_CMENUL.NEXTVAL
CHG_DTT_YN       VARCHAR2(1)  NN   -- 변경구분 (C/U/D)
CHG_DTM          DATE         NN   -- 변경일시
CHG_USID         VARCHAR2(14) NN   -- 변경자사번
DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID  -- 스냅샷

-- 마스터(CMENUM) 비즈니스 컬럼 복제 (스냅샷):
MNU_ID, HRK_MNU_ID, SRE_TC, MNU_NM, MNU_TP_C, SRE_PTH,
MNU_SOT_SQN_SNO, HID_YN, MNU_DEP, WHL_MNU_PTH
```

스냅샷은 마스터 비즈니스 컬럼을 그대로 미러하므로 §3.2에서 제거된 3개 컬럼은 자동으로 로그에도 존재하지 않는다.

주의: `CMENUA` 권한 관계 변경은 `CmenumL`에 자동 기록되지 않는다. 메뉴 권한 변경 이력이 감사 요구사항에 포함되면 `CmenuaL` 로그 엔티티를 추가하거나, `Cmenum`의 변경일시를 함께 갱신해 권한 스냅샷을 별도 조회할 수 있게 해야 한다. 1단계 범위에서는 메뉴 마스터 변경 로그를 우선 구현하고, 권한 관계 로그 필요 여부는 보안/감사 검토 후 결정한다.

### 3.5 정합성 유지

- `WHL_MNU_PTH`/`MNU_DEP`는 **백엔드 `AdminMenuService` 계층에서 계산·저장** (트리거 사용 안 함, 디버깅·테스트 용이)
- 부모 이동 시 모든 후손의 `WHL_MNU_PTH` 일괄 갱신 (트랜잭션 내 재귀 update)
- 순환 참조 방지: 자기 자신 또는 후손을 부모로 지정 시 400
- 깊이 초과: 이동 후 depth가 3 초과 시 400

### 3.6 코드 규약 레이어 (아이콘·배지·동적원천)

meta 미등재 3개 개념은 DB 컬럼이 아니라 **등재 표준용어 `MNU_ID`(VARCHAR2(10), 안정 키)를 단일 조인 키**로 쓰는 코드측 매핑으로 둔다. `MNU_ID`는 시드에서 부여하는 불변 키이므로 라벨·경로·순서가 바뀌어도 매핑이 깨지지 않는다.

**아이콘 — 프론트 정적 맵** (`it_frontend/app/utils/menuPresentation.ts` ★신설):

```ts
// MNU_ID → PrimeVue icon class. 28개 노드에만 존재(나머지는 아이콘 없음).
export const MENU_ICON: Record<string, string> = {
  MINF0001: 'pi pi-wallet',
  MAUD0001: 'pi pi-shield',
  MADM0001: 'pi pi-cog',
  // …
};
```

**배지 — 프론트 resolver key 맵** (동 파일):

```ts
// MNU_ID → 배지 카운트 composable 식별 key. 현재 앱 전체 3건.
export type BadgeKey = 'approvalPending' | 'docReviewing';
export const MENU_BADGE: Record<string, BadgeKey> = {
  MAPV0001: 'approvalPending',  // usePendingApprovalCount / useApprovalBadgeCount
  MDOC0001: 'docReviewing',     // useDocumentBadgeCount
};
```

배지로 표시되는 값은 저장 콘텐츠가 아니라 전용 카운트 API가 실시간 계산하는 건수다. key는 "이 메뉴가 어떤 composable에서 카운트를 받는가"만 지정한다. 새 배지는 어차피 새 composable+API가 필요하므로 코드 변경을 동반한다.

**동적원천 — 백엔드 resolver 맵** (`MenuQueryService`):

```java
// MNU_ID → DYN children 생성 resolver. 현재 1건(구 FNT_C='BOARD_LIST').
private static final Map<String, MenuChildrenResolver> DYN_RESOLVERS =
    Map.of("MBRD0001", boardListResolver);
```

새 동적 소스는 새 백엔드 resolver 구현이 필요하므로 역시 코드 변경을 동반한다. resolver 미존재 `MNU_ID`로 `DYN` 노드가 시드되면 children이 비고, §3.3 규칙에 따라 빈 DYN 노드는 사용자 응답에서 제거된다.

> 트레이드오프: 아이콘 추가/변경은 `MENU_ICON` 수정 + 프론트 배포가 필요하다. 아이콘은 저빈도 디자인 결정이고 4월 IT감사팀 사례(숨김/라벨/순서/권한)는 모두 DB 즉시 편집 대상이므로 영향이 작다. 향후 아이콘 편집성이 필요하면 기존 공통코드(CCODEM) 테이블로 이관할 수 있고, 이때도 메뉴 테이블 스키마는 변경되지 않는다.

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
│   ├── AdminMenuService.java         -- WHL_MNU_PTH/MNU_DEP 재계산 책임
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
- `GET /api/menus`는 인증만 요구하되 서버에서 `cmenua` 매핑과 `authUser.athIds` 교집합으로 필터
- 프론트는 받은 트리를 그대로 렌더 → 권한 판단 책임 서버 일원화
- 동적 메뉴도 동일 원칙을 따른다. `BOARD_LIST` children은 프론트에서 전체 게시판을 받아 필터링하지 않고, 백엔드가 현재 사용자 기준으로 조회 가능한 게시판만 children으로 주입해 응답한다.

### 4.4 캐싱 (1단계에서는 도입 안 함)

- 메뉴 트리 규모(약 70행) + `(SRE_TC, HRK_MNU_ID, MNU_SOT_SQN_SNO)` 인덱스로 직접 쿼리도 ms 단위
- JPA 영속성 컨텍스트 + Oracle SGA가 사실상 캐시 역할 수행
- `@Cacheable` 도입 시 `@CacheEvict` 누락 위험 — 메뉴 수정이 사이드바에 반영되지 않는 종류의 버그가 발생하면 본 기능의 핵심 가치(즉시 반영)가 훼손됨
- 단일 WAR 가정으로 Caffeine은 가능하나 다중 인스턴스 확장 시 비동기화 문제 → 결국 Redis 도입 필요
- **운영 후 측정 (`/api/menus` p95 응답시간):**
  - p95 < 200ms → 캐시 불필요, 현 상태 유지
  - p95 ≥ 200ms 또는 DB 부하 체감 → Caffeine 도입 (단일 WAR 한정) 또는 Redis 검토 — TASK.md 등록
- 측정 수단: Spring Actuator `/actuator/metrics/http.server.requests` 또는 `@Timed` 어노테이션

### 4.5 핵심 서비스 로직 — `AdminMenuService.move(...)`

1. 대상 노드 + 모든 후손 SELECT (`WHERE WHL_MNU_PTH LIKE '/oldPath/%'`)
2. 새 parent의 `WHL_MNU_PTH`·`MNU_DEP` 기준으로 본인 갱신
3. 후손들의 `WHL_MNU_PTH`는 `replace(oldPrefix, newPrefix)`, `MNU_DEP`는 차이만큼 가감
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
├── utils/
│   └── menuPresentation.ts ★신설 (MENU_ICON·MENU_BADGE 규약 맵 §3.6)
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
  - `nodeById: Map<string, MenuNode>` — `WHL_MNU_PTH` split 매핑
- 아이콘·배지 해석: 노드 필드가 아니라 `MENU_ICON[node.mnuId]`·`MENU_BADGE[node.mnuId]`(§3.6)에서 읽는다. 배지 key는 다시 카운트 composable로 연결된다.
- 동적 메뉴 해석:
  - `MNU_TP_C='DYN'` 노드는 백엔드 응답에 이미 권한 필터링된 children이 포함된다(백엔드가 `MNU_ID`로 resolver 식별).
  - 프론트는 동적 소스별 추가 API를 호출하지 않는다. 새 동적 소스는 백엔드 `MenuQueryService`의 `DYN_RESOLVERS` 매핑(§3.6)을 추가한다.
- 캐시 무효화: `/admin/menus` 저장 후 `refresh()` 호출 → 사이드바·Breadcrumb 즉시 반영

### 5.3 `AppSidebar.vue` 리팩토링

- `menuItems = computed(...)` 거대 블록(약 145행) **전체 삭제**
- 데이터 소스: `const { treeByContext } = useMenu(); const menuItems = computed(() => treeByContext.value[context.value] ?? []);`
- 동적 메뉴 children 주입은 `useMenu` 내부에서 처리 → 사이드바는 소스 무관
- 아이콘·배지는 `MENU_ICON[mnuId]`·`MENU_BADGE[mnuId]` 규약 맵(§3.6)에서 읽음(노드 필드 아님), 관리자 표시는 노드 필드
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
  return current.whlMnuPth.split('/').filter(Boolean).map(id => {
    const node = nodeById.value.get(id);
    return {
      label: node?.mnuNm ?? id,
      route: node?.mnuTpC === 'LNK' ? node.srePth : undefined,
    };
  });
});
</script>

<template>
  <Breadcrumb v-if="items.length" :home="home" :model="items" />
</template>
```

- 마지막 노드, `route` 없는 GRP 항목은 PrimeVue가 자동 비활성 처리
- 배치: `layouts/default.vue` 상단 헤더 아래
- 카탈로그 외 페이지(로그인 등)에서는 렌더링하지 않음
- `SRE_PTH`는 query string 포함 경로를 허용한다. `/approval/list?tab=pending`처럼 같은 path에 여러 메뉴가 걸린 경우 breadcrumb는 `route.fullPath`를 우선 사용하고, 일치 항목이 없을 때만 `route.path`로 fallback한다.

### 5.5 관리화면 `/admin/menus`

- **좌측:** PrimeVue `Tree` (drag&drop 활성화)
- **우측 편집 폼:** `MNU_NM`, `MNU_TP_C`, `SRE_PTH`(Dropdown ← `/api/admin/routes`), `HID_YN`, 권한 체크박스
  - 아이콘·배지·동적원천은 폼에 없다(§3.6 코드 규약). DYN 노드의 children 소스는 `MNU_ID`에 대응하는 백엔드 resolver가 결정한다.
- **상단 액션:** [신규] [이력] [삭제]
- 드래그&드롭 부모 변경 → `move` API
- 같은 부모 내 순서 변경 → `reorder` API 일괄 호출
- 저장 후 `useMenu().refresh()`

### 5.6 관리화면 `/admin/routes`

- `StyledDataTable`로 라우트 카탈로그 관리
- `useAdminTableEdit` 컴포저블과 함께 사용 (CLAUDE.md §4.9)
- 컬럼: `SRE_PTH`, `SRE_MNU_NM`, `SRE_TC`, `USE_YN`, `RMK`, BaseEntity 공통

### 5.7 미들웨어/라우트 가드

- 기존 `middleware/admin.ts` 유지 (서버 권한이 최종 보안 경계)
- 라우트 자체의 권한 제어는 변하지 않음 — DB는 "메뉴 노출 여부"만 책임
- `/admin/menus`·`/admin/routes` 페이지는 `definePageMeta({ middleware: 'admin', layout: 'admin' })`

### 5.8 메뉴 관리 메뉴 자체

- `cmenum` 시드에 `MADM0001`, `MADM0002` 추가
- `cmenua`에 `ITPAD001` 매핑만 추가 → 일반 사용자에게 비노출
- 사이드바 `admin` 컨텍스트의 "데이터 관리" 그룹 하위에 배치

## 6. 마이그레이션

Flyway 파일 3개 (CLAUDE.md §4.4 명명 규칙 준수).

### 6.1 `V20260530_001__CreateMenuTables.sql`

- `TPRMPP_CMENUD`, `TPRMPP_CMENUM`, `TPRMPP_CMENUA`, `TPRMPP_CMENUL` 테이블 + 인덱스 + FK + CHECK 제약
- 시퀀스: `SEQ_CMENUL` (BaseLogEntity PK 채번용, `audit_log_sequences_ddl.sql`에 추가)

### 6.2 `V20260530_002__SeedRouteCatalog.sql`

- 현재 `AppSidebar.vue`에서 사용 중인 모든 `to` 경로 약 60건 `TPRMPP_CMENUD`에 INSERT
- `SRE_TC`는 현재 사이드바 컨텍스트 기준으로 매핑
- `USE_YN='Y'`로 일괄 등록

### 6.3 `V20260530_003__SeedMenuTree.sql`

- `AppSidebar.vue`의 모든 `menuItems` 노드를 `TPRMPP_CMENUM`에 INSERT
- `WHL_MNU_PTH`·`MNU_DEP` 명시 계산 후 저장
- `TPRMPP_CMENUA` 매핑: `admin: true` → `ITPAD001` 1행, 그 외 → 매핑 0건(전체 공개)
- 동적 메뉴: 게시판 목록 노드 1건 (`MNU_TP_C='DYN'`, `MNU_ID='MBRD0001'`). 원천 컬럼은 없고 백엔드 `DYN_RESOLVERS`가 `MBRD0001`을 board resolver에 연결(§3.6)
- 관리 메뉴 자체 노드(`MADM0001`, `MADM0002`) 포함
- 아이콘·배지는 시드 대상 아님 — `MENU_ICON`/`MENU_BADGE`는 `MNU_ID` 기준으로 프론트에 정적 정의(§3.6). 시드의 `MNU_ID`와 규약 맵 키 정합성은 §6.4 검증에 포함

### 6.4 시드 정확성 검증 (필수)

배포 직후 다음 검증 스크립트 실행:

- `GET /api/menus` (ROLE=ADMIN)의 응답 트리를 현재 하드코딩 메뉴와 비교
- DB 소관: 라벨·순서·경로·권한·숨김 일치 확인
- 코드 규약 소관(§3.6): 현재 사이드바의 각 노드 아이콘·배지를 `MENU_ICON`/`MENU_BADGE`의 동일 `MNU_ID` 항목과 대조. 시드된 모든 `MNU_ID`가 규약 맵과 정합(누락·고아 키 0건)인지 검증
- DYN 노드의 `MNU_ID`가 백엔드 `DYN_RESOLVERS`에 존재하는지 확인
- `TPRMPP_CMENUD.SRE_PTH`를 Nuxt 실제 라우트 목록 및 `docs/screen-list.csv`와 대조해 미존재 경로가 있으면 실패 처리
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
| Backend Unit | JUnit | `AdminMenuService.move()` — `WHL_MNU_PTH` 후손 일괄 갱신, depth 제한, 순환 방지 |
| Backend Unit | JUnit | `AdminMenuService.delete()` — 후손 존재 시 409 |
| Backend Unit | JUnit | `AdminMenuService.reorder()` — 같은 부모 내 `MNU_SOT_SQN_SNO` 일괄 갱신 |
| Backend Integration | `@SpringBootTest` | `/api/menus` 권한 필터링 (ADMIN vs USER 응답 비교) |
| Backend Integration | `@SpringBootTest` | `/api/menus` 동적 `BOARD_LIST` children 서버 권한 필터링 |
| Backend Integration | `@SpringBootTest` | `/api/admin/menus` `@PreAuthorize` — 비관리자 403 |
| Backend Integration | `@SpringBootTest` | `TPRMPP_CMENUM.SRE_PTH` FK — `TPRMPP_CMENUD`에 없는 경로 저장 시 제약 위반 |
| Backend Integration | `@SpringBootTest` | `CmenumL` 자동 INSERT — `Cmenum` UPDATE 시 `TPRMPP_CMENUL`에 스냅샷 1건 적재 (`CHG_DTT_YN='U'`) |
| Backend Integration | `@SpringBootTest` | Soft Delete 후 `CMENUA` 관계 필터링 및 권한 재추가 복구 |
| Frontend Unit | Vitest | `useMenu` — treeByContext 변환, nodeByPath 인덱스, 서버가 내려준 동적 children 렌더링 |
| Frontend Unit | Vitest | 규약 맵(§3.6) — 시드 `MNU_ID` 집합과 `MENU_ICON`/`MENU_BADGE` 키 정합(고아 키 0건), 미등록 `MNU_ID`는 아이콘/배지 없이 렌더 |
| Frontend Unit | Vitest | `AppBreadcrumb` — `WHL_MNU_PTH` split → items 변환, LNK/GRP 구분, fullPath/query fallback |
| Frontend E2E | Playwright | 관리자가 메뉴 숨김 토글 → 사이드바 즉시 반영 (4월 이슈 회귀 방지) |
| Frontend E2E | Playwright | 일반 사용자에게 admin 전용 메뉴 미노출 |

## 9. 리스크 및 완화책

| 리스크 | 완화책 |
|---|---|
| 시드와 코드 메뉴 불일치로 운영 후 메뉴 누락 | §6.4 검증 스크립트 자동화, 배포 직후 필수 실행 |
| 라우트 카탈로그에 미존재 Nuxt 경로 등록 | 관리자 저장 검증 + 배포 검증 스크립트에서 route manifest/screen-list 대조 |
| 관리자가 본인을 모든 메뉴에서 제외 후 자기 잠금 | `/admin/menus` 자체는 직접 URL + `middleware/admin`으로 항상 접근 가능 — DB 메뉴 노출 설정과 무관 |
| Soft Delete 관계 row가 남아 권한 필터가 오동작 | 모든 조회에서 `DEL_YN='N'` 필터 강제, 권한 재추가 시 기존 row 복구 정책 구현 |
| 부모/자식 권한 불일치로 빈 그룹 노출 | 사용자용 트리 생성 시 권한 없는 부모 하위 제거, children 0개 GRP/DYN 제거 |
| 동시 편집으로 `WHL_MNU_PTH` 충돌 | 메뉴 편집은 관리자 전용·저빈도 → last-write-wins 수용(`VERSION` 미등재로 낙관적 잠금 제거). `move`는 단일 트랜잭션 내 후손 일괄 재계산으로 부분 갱신 방지. 동시성 이슈 실측 시 등재 카운터로 낙관적 잠금 재도입 — TASK.md |
| 시드 `MNU_ID`와 `MENU_ICON`/`MENU_BADGE`/`DYN_RESOLVERS` 키 불일치 | §6.4 검증에 정합성(누락·고아 키 0건) 항목 포함, 배포 직후 필수 실행 |
| 메뉴 조회 부하가 예상보다 클 가능성 | 운영 후 p95 측정. 임계 초과 시에만 캐시 도입(§4.4) — 선제 도입은 캐시 무효화 버그 위험이 더 큼 |
| 신규 페이지 추가 시 `cmenud` 등록 누락 | 루트 `CLAUDE.md` §4에 체크리스트 명시, PR 템플릿에 항목 추가 |
| DYN 메뉴 소스 추가 시 코드 변경 필요 | 본래 코드 종속 개념(§3.0). 동적 소스가 늘어나면 `DYN_RESOLVERS`에 `MNU_ID` 항목 추가 — 현재는 1건이라 YAGNI |

## 10. 문서 업데이트

- `it_backend/CLAUDE.md` §5.2 및 `it_backend/docs/guides/data-model.md`: `menu` 패키지와 `TPRMPP_CMENUD`/`TPRMPP_CMENUM`/`TPRMPP_CMENUA`/`TPRMPP_CMENUL` 매핑 추가
- `it_backend/CLAUDE.md` §5.2: 테이블 용도 1자리 목록에 `D`(상세)·`A`(연결) 명문화(현재 M/L/H만 기재, 실제 `CMENUD`/`CMENUA`/`CAPPLA` 사용 중)
- `it_backend/CLAUDE.md` §5.2: 엔티티는 `@Version`/`VERSION` 컬럼을 두지 않는다는 관례 명시(메타 미등재, 낙관적 잠금 미사용)
- `it_backend/CLAUDE.md` §5.12.1: 감사 로그 적용 엔티티 23개 → 24개(`CmenumL` 추가)
- `it_frontend/CLAUDE.md` §4.6: `pages/admin/menus`, `pages/admin/routes` 추가
- 루트 `CLAUDE.md` §4: **신규 페이지 추가 시 `cmenud` 등록 필수** 워크플로우 명시
- `it_frontend/CLAUDE.md`: 아이콘·배지 규약 맵(`app/utils/menuPresentation.ts`)이 `MNU_ID` 기준임을 명시 — 신규 메뉴 노드 추가 시 필요하면 규약 맵 키를 함께 등록
- `TASK.md`: `/api/menus` 응답시간 측정 후 캐시 도입 검토, DYN 원천 다건화 시 `DYN_RESOLVERS` 분리. (메타 미등재 컬럼 이슈는 §3.6 코드 규약 채택으로 해소 — 등록/예외 승인 불필요)

## 11. 향후 과제 (이 설계 범위 밖)

- 메뉴별 통계(클릭 수, 마지막 접근 시각) — 사용 빈도 기반 정렬 추천
- 사용자별 즐겨찾기 메뉴
- 다국어 라벨 (`MNU_WREN_NM` 등 meta 등재 컬럼 우선 검토)
- DYN 메뉴 소스 카탈로그(현재는 백엔드 `MenuQueryService`의 `DYN_RESOLVERS` 매핑, `MNU_ID` 키)
- 아이콘 관리자 편집성이 필요해지면 기존 공통코드(CCODEM)로 이관(메뉴 테이블 스키마 무변경)
