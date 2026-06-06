# 정보화사업 집행 4단계(소요예산 산정·과업심의위원회·입찰/계약·대금지급) MVP 설계서

- 작성일: 2026-06-07
- 상태: 합의 완료 (구현 대기)
- 범위: 정보화사업(`TPRMPP_BPROJM`)·전산업무비(`TPRMPP_BCOSTM`)에 대한 집행 4단계의 기본 신청/작업 화면 MVP

---

## 1. 개요 및 목표

정보화사업 생애주기 중 예산편성 이후의 **집행 4단계**에 대한 기본 신청/작업 화면을 구현한다.

| 단계 | 설명 | 상태코드(`IT_PTL_STS_TC`) |
|---|---|---|
| ① 소요예산 산정 | 사업에 대해 관련팀(IT계약팀·IT인프라팀·보안인프라팀)이 개발비·HW/SW 등 예산을 산정 | 41·42·49 |
| ② 과업심의위원회 | 사업/전산업무비의 전체 계획을 위원회가 검토·승인 | 51·52·59 |
| ③ 입찰/계약 | 국가계약법에 따른 입찰/계약(협상에의한계약·규격가격동시·수의계약 등) | 61·62·69 |
| ④ 대금지급 | 사업 완료 후 대금지급 요청/작업(한 대상에 여러 회차 지급 가능) | 71·72·79 |

### 핵심 설계 결정 (브레인스토밍 합의)

1. **통합 설계 + 순차 구현**: 4단계를 하나의 설계서로 잡고, 공통 패턴(신청→작업→완료) 위에 단계별 데이터 모델을 정의. 실제 구현은 단계별 순차(단계당 PR).
2. **연결 단위**: 사업/전산업무비 1건당 단계별 요청 1건.
3. **단계 완전 독립**: 단계 간 직접 FK 없음. 각 단계는 대상(사업/전산업무비)과 상태코드로만 연결. 대금지급은 대상 기준으로 여러 회차를 입력.
4. **상세도 = 마스터 + 꼭 필요한 곳만 명세**: 소요예산(팀별 산정행), 대금지급(회차별 지급행)만 명세 테이블. 과업심의·입찰계약은 마스터 only.
5. **권한 = 신청자/작업자 2역할**: 기존 RBAC(`ROLE_USER`/`ROLE_DEPT_MANAGER`/`ROLE_ADMIN`) + `bbrC` 부서 필터링 재사용. 신청/작업은 상태 기반으로 동일 화면에서 분기.
6. **메타 용어 100% 매핑**: 모든 컬럼은 `C:\it\meta.csv`(절대 수정 금지) 등록 용어 사용. 신규 용어 0건. 신규 신청은 공통코드 값 등록 3건뿐.

### 비범위 (후속 고도화)

- 단계 간 자동 상태 승급(완료 → 다음 단계 자동 시작)
- 대금지급 누계/계약금액 초과 검증
- 위원/일정/평가 등 council 수준 상세 모델
- 결재 연동, 알림 연동(필요 시 기존 메커니즘 차용)
- 팀코드별 세분 작업 권한

---

## 2. 아키텍처

### 2.1 백엔드 도메인 구조 (A안: 단계별 독립 도메인)

기존 `council` 도메인의 "신청→작업→완료 + 상태전이" 패턴을 템플릿으로 사용. 최상위 평면 도메인 컨벤션 유지.

```
it_backend/src/main/java/com/kdb/it/domain/
├── estimate/      (소요예산 산정)   controller / dto / service / repository / entity
├── deliberation/  (과업심의위원회)  controller / dto / service / repository / entity
├── contract/      (입찰/계약)       controller / dto / service / repository / entity
└── payment/       (대금지급)        controller / dto / service / repository / entity
```

공통 로직(상태 전이 `changeStatus()`, 대상 검증, 대상 통합 조회)은 작은 공유 유틸로 추출하여 중복 최소화.

### 2.2 프론트엔드 라우팅

```
it_frontend/app/pages/project/
├── estimate/      index.vue, [docNo].vue
├── deliberation/  index.vue, [docNo].vue
├── contract/      index.vue, [docNo].vue
└── payment/       index.vue, [docNo].vue
```

사이드바 메뉴(`Cmenum`)에 "사업 관리/집행" 그룹(GRP) + 4개 링크(LNK)를 DB 시드(명칭은 시드 시 확정).

---

## 3. 데이터 모델

### 3.1 테이블/엔티티 명명

| 단계 | 마스터 | 명세(자식) | 로그 엔티티 |
|---|---|---|---|
| ① 소요예산 산정 | `Bestim` → `TPRMPP_BESTIM` | `Bestid` → `TPRMPP_BESTID` | `BestimL`, `BestidL` |
| ② 과업심의위원회 | `Bdelim` → `TPRMPP_BDELIM` | — | `BdelimL` |
| ③ 입찰/계약 | `Bcontm` → `TPRMPP_BCONTM` | — | `BcontmL` |
| ④ 대금지급 | `Bpaymm` → `TPRMPP_BPAYMM` | `Bpaymd` → `TPRMPP_BPAYMD` | `BpaymmL`, `BpaymdL` |

- 도메인 접두 `ESTI`/`DELI`/`CONT`/`PAYM`로 그룹화. 명세는 용도문자 `D`(상세)로 마스터(`M`)와 짝.
- 모든 마스터/명세는 `BaseEntity` 상속 + `@LogTarget(entity = *L.class)`. 짝 `*L` 로그 엔티티는 `BaseLogEntity` 상속. (총 마스터/명세 6개 → `*L` 6개)
- 삭제는 Soft Delete(`DEL_YN='Y'`)만. 물리 삭제 금지.
- 복합키는 `@IdClass` 패턴.

### 3.2 공통 마스터 컬럼 (4개 마스터 공유)

| 논리명 | 물리명 | 타입 | 상태 | 비고 |
|---|---|---|---|---|
| 문서번호 (PK1) | `RQM_BG_REQ_DOC_NO`(①) / `DOC_MNG_NO`(②③④) | VARCHAR2(30)/(20) | ✅ 메타 | 채번 `{접두}-{YYYY}-{4seq}` |
| 문서버전일련번호 (PK2) | `DOC_VRS_SNO` | NUMBER(9) | ✅ 메타 | 버전 구분 |
| 최종여부 | `LST_YN` | VARCHAR2(1) | ✅ 메타 | `'Y'`=현재버전 |
| 대상구분코드 | `BG_PRN_TC` (예산성격구분코드) | VARCHAR2(3) | ✅ 메타 | 공통코드 `IT_PTL_BG_PRN_TC`: 100=정보화사업, 200=전산업무비 |
| 대상관리번호 | `CNCD_RFR_NO` (관련참조번호) | VARCHAR2(30) | ✅ 메타 | 사업=`ABUS_MNG_NO`, 전산업무비=`BG_NO` 값 |
| 진행상태코드 | `IT_PTL_STS_TC` | VARCHAR2(2) | ✅ 메타 | 단계별 작성중/진행중/완료 |
| 요청내용 | `REQ_CONE` | VARCHAR2(300) | ✅ 메타 | |

> **버전 PK 채택 근거**: 마스터는 `(문서번호 + DOC_VRS_SNO)` 복합키 + `LST_YN='Y'`=현재버전. 기존 `Bprojm`(`ABUS_MNG_NO`+`SNO`)·`Bcostm`(`BG_NO`+`BG_SNO`) 컨벤션과 정합.

감사·생성자/수정자·삭제여부는 `BaseEntity` 자동 제공(`DEL_YN`, `GUID`, `FST_ENR_DTM/USID`, `LST_CHG_DTM/USID`). 요청자=`FST_ENR_USID`, 요청일시=`FST_ENR_DTM` 재사용(별도 컬럼 없음).

### 3.3 단계별 고유 컬럼 (모두 메타 실재 ✅)

#### ① 소요예산 산정 — `Bestim`(요청, 대상=사업 고정) + `Bestid`(팀별 산정행)

`Bestim` PK `(RQM_BG_REQ_DOC_NO, DOC_VRS_SNO)`
- 대상=사업 고정: `BG_PRN_TC='100'`, `CNCD_RFR_NO`=사업 `ABUS_MNG_NO`

`Bestid` PK `(RQM_BG_REQ_DOC_NO, DOC_VRS_SNO, SVN_TEM_C, IOE_C)` — 자연키(팀+비목)

| 논리명 | 물리명 | 타입 |
|---|---|---|
| 담당팀코드 | `SVN_TEM_C` | VARCHAR2(5) |
| 비목코드 | `IOE_C` | VARCHAR2(7) |
| 소요예산금액 | `RQM_BG_AMT` | NUMBER(18) |
| 의견내용 | `OPNN_CONE` | VARCHAR2 |

#### ② 과업심의위원회 — `Bdelim` 마스터 only

PK `(DOC_MNG_NO, DOC_VRS_SNO)`

| 논리명 | 물리명 | 타입 |
|---|---|---|
| 과업심의구분코드 | `TASK_DBR_TC` | VARCHAR2(2) |
| 과업심의결과구분코드 | `TASK_DBR_RLT_TC` | VARCHAR2(2) |
| 과업심의일자 | `TASK_DBR_DT` | VARCHAR2(8) |
| 과업심의회차 | `TASK_DBR_TOD` | VARCHAR2(2) |
| 과업심의생략여부 | `TASK_DBR_OMT_YN` | VARCHAR2(1) |
| 과업심의생략사유 | `TASK_DBR_OMT_RSN` | VARCHAR2(200) |
| 심의의견 | `OPNN_CONE` | VARCHAR2 |
| 반려사유 | `APV_TRDN_RSN_CONE` | VARCHAR2(300) |

#### ③ 입찰/계약 — `Bcontm` 마스터 only

PK `(DOC_MNG_NO, DOC_VRS_SNO)`

| 논리명 | 물리명 | 타입 |
|---|---|---|
| 계약방법코드 | `CTT_MANR_C` | VARCHAR2(2) |
| 계약방법사유 | `CTT_MANR_RSN` | VARCHAR2(1000) |
| 계약명 | `CTT_NM` | VARCHAR2(100) |
| 계약금액 | `CTT_AMT` | NUMBER(18,3) |
| 계약상대처명 | `CTT_OPP_NM` | VARCHAR2(100) |
| 계약일자 | `CTT_DT` | VARCHAR2(8) |

#### ④ 대금지급 — `Bpaymm`(대상 기준) + `Bpaymd`(회차별 지급행)

`Bpaymm` PK `(DOC_MNG_NO, DOC_VRS_SNO)`
- 계약 정보 직접 입력(단계 독립): `CTT_NM`(계약명), `CTT_AMT`(계약금액)

`Bpaymd` PK `(DOC_MNG_NO, DOC_VRS_SNO, DFR_TOD)` — 자연키(지급회차)

| 논리명 | 물리명 | 타입 |
|---|---|---|
| 지급회차 | `DFR_TOD` | NUMBER(5) |
| 지급금액 | `DFR_AMT` | NUMBER(18,3) |
| 지급일자 | `DFR_DT` | VARCHAR2(8) |
| 지급예정일자 | `DFR_MPL_DT` | VARCHAR2(8) |
| 적요(의견내용) | `OPNN_CONE` | VARCHAR2 |

### 3.4 신규 신청 목록 (메타 절대 수정 금지 → 별도 신청)

- **신규 용어: 0건** (전 컬럼 기존 메타 용어 매핑 완료)
- **프로젝트 전용 공통코드 등록 3건** (각 컬럼 길이에 맞춘 코드값):
  1. `IT_PTL_BG_PRN_TC` — 100(정보화사업), 200(전산업무비)  · 컬럼 `BG_PRN_TC` VARCHAR2(3)
  2. `TASK_DBR_RLT_TC` — 01(승인), 02(반려), 03(조건부)  · 컬럼 VARCHAR2(2)
  3. `CTT_MANR_C` — 01(협상에의한계약), 02(규격가격동시), 03(수의계약) 등  · 컬럼 VARCHAR2(2)

---

## 4. 상태 전이 흐름

각 단계는 `IT_PTL_STS_TC` 3-상태(작성중 → 진행중 → 완료)로 동작. 단계 간 직접 FK 없이 대상 상태코드로만 연결.

```
① 소요예산: [41 작성중] --신청제출--> [42 진행중] --팀산정완료--> [49 완료]
② 과업심의: [51 작성중] --신청제출--> [52 진행중] --심의의결--> [59 완료]
③ 입찰계약: [61 작성중] --신청제출--> [62 진행중] --계약체결--> [69 완료]
④ 대금지급: [71 작성중] --신청제출--> [72 진행중] --지급확정--> [79 완료]
```

| 상태 | 쓰기 가능 주체 | 가능 동작 |
|---|---|---|
| 작성중 (x1) | 신청자(본인/부서) | 마스터 생성/수정, soft delete, 신청 제출 |
| 진행중 (x2) | 작업자(담당팀/관리자) | 명세·결과 입력, 완료 확정 (신청 영역 읽기 전용) |
| 완료 (x9) | 없음 | 전체 읽기 전용(잠금) |

### 전이 규칙

- 전이는 **서버 서비스 계층 `changeStatus()`에서만** 수행. 인접 전이만 허용(역행·건너뛰기 차단).
- 상태별 쓰기 주체를 서비스에서 검증. 프론트 버튼 노출은 UX 보조.
- 단계 완료 시 다음 단계로 자동 승급하지 않음(독립 단계). 각 단계 신청은 사용자가 명시적으로 시작.
- 변경 로그는 기존 `@LogTarget` 메커니즘으로 자동 적재.

### 대금지급 특이사항

- `Bpaymm`(마스터)은 대상당 1건. 진행중(72) 상태에서 `Bpaymd`(회차) 행을 여러 번 추가.
- "완료(79)"는 더 이상 지급이 없을 때 작업자가 수동 확정. 누계 검증은 후속 고도화(MVP는 자유 입력).

---

## 5. 화면 구성

기존 프론트 컨벤션(`StyledDataTable`, 사이드바 메뉴, SSR-safe `useFetch`/`useAsyncData`) 재사용. 각 단계는 **목록 → 상세(신청/작업 겸용)** 2화면. 역할은 상태 기반으로 동일 화면에서 분기.

### 5.1 공통 목록 화면 (4단계 동일 골격)

- `StyledDataTable` 컬럼: 대상(사업/전산업무비명), 대상구분, 상태(`IT_PTL_STS_TC` 배지), 요청일, 작성자.
- 상단 필터: 상태, 대상구분(`BG_PRN_TC`), 연도, 검색어. 부서 필터(`bbrC`)는 서버 권한 적용.
- "신규 신청" 버튼 → 대상 선택 모달(사업/전산업무비 검색) → 상세 화면 작성중 진입.

### 5.2 공통 상세 화면 (신청+작업 겸용, 상태로 분기)

- **헤더**: 대상 정보(읽기 전용, 사업/전산업무비에서 조회), 상태 배지, 상태별 액션 버튼.
- **작성중(x1)**: 신청자 입력 폼 활성 → [저장][신청 제출][삭제].
- **진행중(x2)**: 신청 영역 읽기 전용 + 작업 영역 활성(작업자만) → [작업 저장][완료 확정].
- **완료(x9)**: 전체 읽기 전용.
- 변경 이력은 기존 로그(`*L`) 기반(MVP는 노출 선택).

### 5.3 단계별 상세 화면 고유 작업 영역

- **① 소요예산**: 팀별 산정 그리드(행: IT계약팀/IT인프라팀/보안인프라팀 × 비목, 열: 소요예산금액·의견). 합계 표시.
- **② 과업심의**: 심의구분·심의회차·심의일자·심의결과(승인/반려/조건부)·의견. 생략 시 생략여부+사유.
- **③ 입찰/계약**: 계약방법(+사유)·계약명·계약금액·계약상대처·계약일자.
- **④ 대금지급**: 회차별 지급 그리드(행 추가, 회차/지급금액/지급일/적요). 누계 표시.

---

## 6. API 설계

기준경로 `/api/project/{단계}` (복수형: `estimates`/`deliberations`/`contracts`/`payments`). 응답은 기존 규약(§6 상태코드). mutation은 `@Valid`, 모든 `@RequestParam`/`@PathVariable`에 `name=` 명시(§5.5.3).

### 6.1 공통 엔드포인트 패턴 (예: estimates)

| 메서드 | 경로 | 용도 | 허용 상태/역할 |
|---|---|---|---|
| `GET` | `/api/project/estimates` | 목록(필터 `status`,`prnTc`,`year`,`q`,`bbrC`) | 인증 |
| `GET` | `/api/project/estimates/{docNo}` | 상세(현재버전 `LST_YN='Y'`) | 인증 |
| `POST` | `/api/project/estimates` | 신규 신청 생성(작성중) | 신청자 |
| `PUT` | `/api/project/estimates/{docNo}` | 마스터 수정 | 작성중 + 신청자 |
| `DELETE` | `/api/project/estimates/{docNo}` | soft delete | 작성중 + 신청자 |
| `PATCH` | `/api/project/estimates/{docNo}/status` | 상태 전이(제출/확정) | 서비스 검증 |

### 6.2 단계별 추가 엔드포인트

- **① 소요예산**: `PUT /api/project/estimates/{docNo}/lines` — 팀별 산정행(`Bestid`) 일괄 저장(작업자, 진행중). 요청 포함 행 upsert, 누락 행 soft delete(`Bitemm` 동기화 패턴 재사용).
- **② 과업심의**: 작업 입력은 마스터 `PUT`에 포함.
- **③ 입찰/계약**: 작업 입력은 마스터 `PUT`에 포함.
- **④ 대금지급**: `POST /api/project/payments/{docNo}/installments` 회차 추가, `DELETE …/installments/{tod}` 회차 삭제(작업자, 진행중).

### 6.3 대상 조회 (신규 신청 모달)

- `GET /api/project/targets?prnTc=&q=&year=` — 사업(`Bprojm`)/전산업무비(`Bcostm`) 통합 검색. 기존 조회 로직 재사용, `prnTc`로 분기.

### 6.4 권한·보안

- 컨트롤러 `@PreAuthorize`는 **인증만**(ADMIN 전용 아님). 쓰기 주체(신청자 vs 작업자)·상태 전이 적법성은 **서비스 계층 검증** → 위반 시 `AccessDeniedException`/400.
- 목록은 `bbrC` 부서 필터링(§5.14): 관리자 전체, 일반 사용자 소속 부서.
- 상태 전이는 인접 전이만 허용하는 `changeStatus()`로 일원화. 변경 로그 자동 적재.

### 6.5 DTO

- 단계별 `XxxDto`에 정적 중첩(`ListItem`,`Detail`,`CreateRequest`,`UpdateRequest`,`StatusRequest`,`LineRequest`) + `@Schema(name, description)`.

---

## 7. 오류·검증

검증은 서비스 경계에서 수행. DTO `@Valid`(`@NotNull`/`@Size`)와 이중.

- **대상 유효성**: `BG_PRN_TC`(100/200)에 맞는 대상이 `CNCD_RFR_NO`로 실재하고 현재버전(`LST_YN='Y'`)인지 확인. 없으면 400.
- **중복 신청 방지**: 동일 대상+단계에 진행중(x1/x2) 문서 존재 시 신규 생성 차단(완료/삭제 건 허용).
- **상태 전이 적법성**: 인접 전이만. 역행·건너뛰기 400.
- **상태별 쓰기 주체**: 작성중=신청자 본인/부서, 진행중 작업=작업자 역할. 위반 시 `AccessDeniedException`.
- **금액·코드**: `RQM_BG_AMT`/`CTT_AMT`/`DFR_AMT` ≥ 0. 코드값은 등록된 공통코드(`IT_PTL_BG_PRN_TC`/`TASK_DBR_RLT_TC`/`CTT_MANR_C`) 값만 허용.
- **입력 정제**: 자유 텍스트(`REQ_CONE`/`OPNN_CONE`/`CTT_MANR_RSN`)는 저장 전 `HtmlSanitizer` 적용.
- **오류 응답**: 기존 전역 예외 핸들러 + 응답 규약(400/401/403/404) 재사용. 내부 메시지·스택 미노출.

---

## 8. 테스트 (TDD, §5.9 / 80%+)

- **단위(서비스)**: 상태 전이 매트릭스(허용/차단), 권한 분기(신청자/작업자/타부서), 중복 신청 차단, 대상 검증, 명세 동기화(소요예산 upsert·삭제), 대금지급 회차 추가/삭제.
- **컨트롤러(WebMvc)**: 엔드포인트별 200/201/204/400/403, `@RequestParam name=` 회귀.
- **Repository**: `bbrC` 지정/미지정, `LST_YN` 현재버전 조회.
- **프론트(vitest)**: 상태별 폼 활성/잠금 분기, 목록 필터.
- **변경 로그**: `@LogTarget` 적재 1건 확인(대표 엔티티).

---

## 9. 구현 순서 (순차, 단계별 PR)

0. **선행 공통 작업**
   - 프로젝트 전용 공통코드 3건 등록(`IT_PTL_BG_PRN_TC` 100/200, `TASK_DBR_RLT_TC` 01/02/03, `CTT_MANR_C` 01/02/03)
   - 공유 유틸: `changeStatus()`, 대상 검증, 대상 통합 조회 API(`/api/project/targets`)
   - 사이드바 메뉴 시드("사업 관리/집행" 그룹 + 4 링크)
1. **① 소요예산 산정** (마스터+명세+팀 그리드) — 패턴 검증 기준
2. **② 과업심의위원회** (마스터 only)
3. **③ 입찰/계약** (마스터 only)
4. **④ 대금지급** (마스터+회차 명세)

각 단계 = Flyway 마이그레이션(`V{YYYYMMDD_NNN}__Create…`) → 엔티티+`*L` → Repository → Service(+test) → Controller(+test) → 프론트 목록/상세 → 메뉴 노출.

### 마이그레이션 (`it_database/migrations/`)

- 테이블 6개(`BESTIM`/`BESTID`/`BDELIM`/`BCONTM`/`BPAYMM`/`BPAYMD`) + 로그 테이블/시퀀스 + 공통코드 값 DML.
- 각 스크립트 멱등성 유지. 성공한 스크립트 수정 금지.

---

## 부록 A. 메타 용어 매핑 검증 (2026-06-07 grep 확인)

| 용어 | 물리명 | meta No. | 비고 |
|---|---|---|---|
| 소요예산요청문서번호 | `RQM_BG_REQ_DOC_NO` | 37937 | VARCHAR2(30) |
| 문서관리번호 | `DOC_MNG_NO` | 26580 | VARCHAR2(20) |
| 문서버전일련번호 | `DOC_VRS_SNO` | 26592 | NUMBER(9) |
| 소요예산금액 | `RQM_BG_AMT` | 37933 | NUMBER(18) |
| 예산성격구분코드(대상구분) | `BG_PRN_TC` | 46986 | VARCHAR2(3) |
| 관련참조번호(대상관리번호) | `CNCD_RFR_NO` | 12146 | VARCHAR2(30) |
| 과업심의결과구분코드 | `TASK_DBR_RLT_TC` | 11893 | VARCHAR2(2) |
| 과업심의구분코드 | `TASK_DBR_TC` | 11894 | VARCHAR2(2) |
| 과업심의생략사유 | `TASK_DBR_OMT_RSN` | 11895 | VARCHAR2(200) |
| 과업심의생략여부 | `TASK_DBR_OMT_YN` | 11896 | VARCHAR2(1) |
| 과업심의일자 | `TASK_DBR_DT` | 11897 | VARCHAR2(8) |
| 과업심의회차 | `TASK_DBR_TOD` | 11898 | VARCHAR2(2) |
| 계약방법코드 | `CTT_MANR_C` | 9956 | VARCHAR2(2) |
| 계약방법사유 | `CTT_MANR_RSN` | 9955 | VARCHAR2(1000) |
| 계약명 | `CTT_NM` | 9950 | VARCHAR2(100) |
| 계약금액 | `CTT_AMT` | 9908 | NUMBER(18,3) |
| 계약상대처명 | `CTT_OPP_NM` | 9974 | VARCHAR2(100) |
| 계약일자 | `CTT_DT` | 10040 | VARCHAR2(8) |
| 지급금액 | `DFR_AMT` | 63500 | NUMBER(18,3) |
| 지급예정일자 | `DFR_MPL_DT` | 63655 | VARCHAR2(8) |
| 지급일자 | `DFR_DT` | 63721 | VARCHAR2(8) |
| 지급회차 | `DFR_TOD` | 63919 | NUMBER(5) |
| 비목코드 | `IOE_C` | 33404 | VARCHAR2(7) |
| 담당팀코드 | `SVN_TEM_C` | (Bcostm 사용) | VARCHAR2(5) |
| 요청내용 | `REQ_CONE` | 49011 | VARCHAR2(300) |
| 의견내용 | `OPNN_CONE` | (기존 사용) | VARCHAR2 |
| 승인반려사유내용 | `APV_TRDN_RSN_CONE` | 677 류 | VARCHAR2(300) |
| 사업관리번호 | `ABUS_MNG_NO` | 33849 | VARCHAR2(30) |
| 예산번호 | `BG_NO` | 46980 | VARCHAR2(15) |

> 신규 용어: 없음. `OPNN_CONE`/`SVN_TEM_C`/`APV_TRDN_RSN_CONE`는 기존 엔티티에서 사용 중인 용어로 길이는 구현 시 메타 정의값으로 확정.
