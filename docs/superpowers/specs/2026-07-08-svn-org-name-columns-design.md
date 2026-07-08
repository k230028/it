# 주관부서명/주관팀명 컬럼 추가 (SVN_DPM_NM / SVN_TEM_NM) 설계

- 작성일: 2026-07-08
- 배경: 운영DB-로컬DB Gap 분석에서 운영에만 존재하는 `SVN_DPM_NM`/`SVN_TEM_NM` 컬럼 12건(6개 테이블 × 2컬럼)을 확인. 로컬 스키마와 애플리케이션 로직을 운영 기준으로 정렬한다.

## 1. 요구사항

6개 테이블(`TPRMPP_BCOSTM`/`BCOSTL`, `TPRMPP_BPROJM`/`BPROJL`, `TPRMPP_BRDOCM`/`BRDOCL`)에
`SVN_DPM_NM`(주관부서명), `SVN_TEM_NM`(주관팀명) 컬럼을 추가하고, 백엔드/프론트 로직을 연동한다.

- 운영 스펙과 동일: `VARCHAR2(100 CHAR)`, nullable, 백필 없음.
- 이름 값은 **저장 시점 스냅샷** (사용자 결정): 조직명이 나중에 바뀌어도 과거 레코드는 그대로 유지.
- 기존 화면(프로젝트/비용)은 **저장값 우선, null이면 기존 CORGNI 조인 폴백** (사용자 결정).
- 요구사항정의서(BRDOCM) 화면에 주관부서/팀명 표시 신규 추가 (사용자 결정).

## 2. 현재 구조 (조사 결과)

### 코드 컬럼(SVN_DPM_C/SVN_TEM_C) 설정 방식 — 테이블별로 다름

| 테이블 | SVN_DPM_C | SVN_TEM_C |
|---|---|---|
| BPROJM | 사용자 폼 선택 (생성+수정) | 작성자 소속팀 자동할당 (`assignSvnTemC`, 생성 시 1회) |
| BCOSTM (`costSvnDpmC`) | 사용자 폼 선택 (생성+수정) | 사용자 폼 선택 (생성+수정) |
| BRDOCM | 작성자 소속 자동할당 (`assignAuthorOrg`, 생성/새버전 시) | 동일 |

### 기존 이름 해석 패턴 (조회 시점, DB 미저장)
- `ProjectService.java:804-805, 846-848, 952-958` — `corgnIRepository`로 `orgNameMap` 빌드 → DTO `svnDpmCNm` 채움.
- `CostService.java:621-668, 803-807` — 동일 패턴, DTO `costSvnDpmNm`/`svnTemNm`.
- `BudgetStatusQueryRepositoryImpl` — QueryDSL로 CORGNI 조인.
- `ServiceRequestDocService`(BRDOCM) — 이름 해석 로직 **없음**.
- 조직 마스터: `TPRMPP_CORGNI` / 엔티티 `CorgnI` (`prlmOgzCCone`=코드, `bbrNm`=이름). 부서/팀 모두 동일 마스터.

### 감사 로그 메커니즘
- `*L` 로그 엔티티는 `ChangeLogEntityListener` → `AuditLogPersister`가 리플렉션으로 동일 필드명을 복사. 마스터 엔티티에 필드를 추가하고 L 엔티티에 같은 필드를 선언하면 서비스 코드 수정 없이 자동 미러링.
- 신규 컬럼은 nullable이므로 §5.12.1.1(NOT NULL 스냅샷 타이밍 함정) 비해당.

## 3. 설계

### 핵심 원칙
**"코드가 설정/변경되는 모든 지점에서, 같은 시점에 이름도 함께 resolve해서 저장한다."**
자동할당 필드는 자연히 생성 시점 스냅샷이 되고, 사용자 선택 필드는 수정 시마다 이름도 갱신된다.
"스냅샷 vs 라이브" 분기 없이 단일 규칙.

### 3.1 DB 마이그레이션
`it_database/migrations/V20260708_004__AddSvnOrgNameColumns.sql`:
- 6개 테이블에 `SVN_DPM_NM VARCHAR2(100 CHAR)`, `SVN_TEM_NM VARCHAR2(100 CHAR)` 추가 + 코멘트(주관부서명/주관팀명).
- 멱등: 컬럼 존재 시 스킵 (V20260708_001 패턴).
- 백필 없음 (운영과 동일, V20260701_002 선례).

### 3.2 공통 이름 해석기 (신규)
`common/iam/service/OrgNameResolver`:
- `String resolveName(String orgCode)` — null/blank → null, CORGNI 미조회 → null.
- `CorgnIRepository` 주입. 부서/팀 코드 모두 동일 마스터라 메서드 하나로 충분.

### 3.3 엔티티 (M+L 6쌍)
- `Bprojm`/`BprojmL`, `Bcostm`/`BcostmL`, `Brdocm`/`BrdocmL`에 `svnDpmNm`, `svnTemNm` 필드 추가
  (`@Column(name="SVN_DPM_NM", length=100, comment="주관부서명")` 등).
- 코드 설정 메서드에 이름 파라미터 확장:
  - `Bprojm.assignSvnTemC(svnTemC)` → `assignSvnTem(svnTemC, svnTemNm)`, `update(...)`에 svnDpmNm 반영.
  - `Bcostm.update(...)` — costSvnDpmC/svnTemC 옆에 이름 세팅.
  - `Brdocm.assignAuthorOrg(svnDpmC, svnTemC)` → `assignAuthorOrg(svnDpmC, svnDpmNm, svnTemC, svnTemNm)`.

### 3.4 서비스
- `ProjectService`: 생성/수정에서 `svnDpmC` 세팅 시 `orgNameResolver.resolveName()` 동반, `svnTemC` 자동할당 시 동일.
- `CostService`: 생성/수정에서 `costSvnDpmC`/`svnTemC` 세팅 시 동반.
- `ServiceRequestDocService`: `assignAuthorOrg` 호출부(생성 :193, 새버전 :271)에서 이름 함께 resolve.

### 3.5 조회(DTO)
- `ProjectDto.svnDpmCNm`, `CostDto.costSvnDpmNm`/`svnTemNm`: **엔티티 저장값 우선, null이면 기존 CORGNI 조인 폴백**. DTO 필드명 유지 → 프론트 무변경.
- `ServiceRequestDocDto`: `svnDpmNm`/`svnTemNm` 필드 신규 추가 (저장값 그대로).

### 3.6 프론트엔드
- 프로젝트/비용 화면: 변경 없음.
- 요구사항정의서: `pages/info/documents/list.vue` 목록 컬럼 + `[id]/index.vue` 상세에 주관부서명/주관팀명 표시 (읽기 전용).

## 4. 테스트

- `OrgNameResolver` 단위 테스트: 정상/null/미조회.
- `ProjectService`/`CostService`/`ServiceRequestDocService` 생성·수정 시 이름 저장 검증 (코드 있음/없음/CORGNI 미등록).
- 조회 폴백: 저장값 있으면 그대로, null이면 조인 결과.
- 프론트 documents 목록/상세 표시.

## 5. 비범위 (YAGNI)

- 기존 행 백필 배치 (운영도 없음).
- BudgetStatusQueryRepositoryImpl의 조인 제거 (기존 동작 유지, 폴백 역할).
- 조직명 변경 시 일괄 갱신 기능 (스냅샷 원칙에 반함).
