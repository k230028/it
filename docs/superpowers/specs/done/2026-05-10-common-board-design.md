# 공통 게시판 설계 스펙

- **작성일**: 2026-05-10
- **상태**: Draft (사용자 검토 대기 — v4: LV→LEV 정합)
- **대상 시스템**: IT Project Portal (it_backend / it_frontend)
- **참조 문서**: 루트 `CLAUDE.md`, 루트 `README.md` §11(메타 용어), `it_backend/CLAUDE.md`, `it_backend/docs/guides/data-model.md`, 루트 `META.md`

---

## 1. 개요

### 1.1 목적
프로젝트 전반에서 재사용 가능한 **공통 게시판** 기능을 설계·구현한다. 1차 도입 대상은 **공지사항**과 **자료실**이며, 추후 동일한 인프라 위에서 FAQ·Q&A 등 추가 게시판이 운영자 화면에서 동적으로 생성될 수 있어야 한다.

### 1.2 1차 스코프 (In Scope)
- 게시판 메타 관리 (`TPRMPP_CBLBMM`) + 운영자용 관리 화면
- 게시물 CRUD + 답변글(트리) + Soft Delete (`TPRMPP_CBLBCM`)
- 댓글 + 대댓글(무제한 트리) (`TPRMPP_CCMMTM`)
- 공통 첨부파일 시스템(`Cfilem`) 연동
- Tiptap 리치 에디터 + 서버측 `HtmlSanitizer` 적용
- 게시판 단위/게시물 단위 가시성·작성 권한 이중 제어
- 공개 시작/종료 기간, 노출 플래그, 상위고정
- 변경 이력(`*L`) 자동 적재 — `@LogTarget` 패턴
- 사이드바 메뉴 자동 생성 (메타 데이터 기반)
- 본문/제목/작성자 검색, 페이징, 정렬

### 1.3 비-스코프 (1차 미포함)
- 댓글 첨부파일 (텍스트 본문만)
- 임시저장
- 알림 (메일/슬랙)
- 북마크/스크랩
- Oracle Text 전문 인덱스
- 다운로드 카운트 (자료실)
- 게시물 좋아요/추천
- 비밀글
- 외부 사용자 노출

### 1.4 비기능 요구사항
- 사용자 규모: 약 3,000명 사내 임직원
- 게시물 본문 평균 크기: ~50KB (HTML)
- 첨부 최대 50MB / 요청 200MB (전역 정책 준용)
- API 응답 p95: 단건 200ms, 목록 500ms (게시판 1만 건 기준)
- 한글 주석 원칙 준수 (CLAUDE.md §4.1)

---

## 2. 핵심 결정사항 요약

| # | 항목 | 결정 |
|---|---|---|
| 1 | 답변글 트리 표현 | **그룹+순서+레벨 3컬럼** (`NAC_GRP_NO`/`NAC_GRP_SQN`/`NAC_GRP_LEV`) + `HRK_NAC_MNG_NO` 보존 |
| 2 | 게시판 정책 분기 | **`TPRMPP_CBLBMM` 메타 테이블 신설** + 운영자 관리화면 |
| 3 | 본문 컬럼 타입 | **CLOB / `String`** (`Brivgm` 패턴) |
| 4 | 부서·역할 가시성 | **이중 제어** — 메타 권한 + 게시물 `BBR_C` |
| 5 | 첨부파일 ORC_DTT | **단일값 `"공통게시판"`** |
| 6 | 댓글 기능 | **답변글(`REP`) + 댓글(`CMMT`) 둘 다 유지**. 댓글도 무제한 트리(`CMMT_GRP_*` 3컬럼). 1차 첨부 미지원 |

---

## 3. 데이터 모델

### 3.1 명명 규칙

#### 3.1.1 테이블·엔티티
| 항목 | 값 |
|---|---|
| 게시판 메타 테이블 | `TPRMPP_CBLBMM` |
| 게시판 메타 엔티티 | `Cblbmm` (`com.kdb.it.common.board.entity`) |
| 게시판 본문 테이블 | `TPRMPP_CBLBCM` |
| 게시판 본문 엔티티 | `Cblbcm` |
| 게시판 본문 변경 로그 테이블 | `TPRMPP_CBLBCL` |
| 게시판 본문 변경 로그 엔티티 | `CblbcmL` |
| 게시판 메타 변경 로그 테이블 | `TPRMPP_CBLBML` |
| 게시판 메타 변경 로그 엔티티 | `CblbmmL` |
| 게시판 댓글 테이블 | `TPRMPP_CCMMTM` |
| 게시판 댓글 엔티티 | `Ccmmtm` |
| 게시판 댓글 변경 로그 테이블 | `TPRMPP_CCMMTL` |
| 게시판 댓글 변경 로그 엔티티 | `CcmmtmL` |

#### 3.1.2 도메인 prefix 분리
- **메타** 컬럼: `BLB_*` (게시판 — 메타용어)
- **본문(게시물)** 컬럼: `NAC_*` (게시물 — 메타용어)

> **명명 비일관성 안내**: 본문 테이블 식별자는 `TPRMPP_CBLBCM`(`Cblbcm`/`IDX_CBLBCM_*`)으로 유지되지만, 컬럼 prefix는 `NAC_*`(게시물)로 통일한다. 테이블명은 게시판 도메인 그룹핑(공통+게시판+콘텐츠+마스터) 의도이며, 컬럼은 메타용어 사전(`NAC=게시물`)을 따른다. 두 식별자 모두 동일한 게시판 본문을 가리킨다.

#### 3.1.3 채번 형식
| 항목 | 형식 | 예시 |
|---|---|---|
| 게시판 메타 PK (`BLB_MNG_NO`) | `BLBM-{YYYY}-{0001}` | `BLBM-2026-0001` |
| 게시물 PK (`NAC_MNG_NO`) | `NAC-{YYYY}-{0001}` | `NAC-2026-0001` |
| 댓글 PK (`CMMT_MNG_NO`) | `CMMT-{YYYY}-{0001}` | `CMMT-2026-0001` |

#### 3.1.4 약어 사전 매핑
- ✅ = META.md 표준단어에 존재 (그대로 사용)
- 🔧 = 기존 엔티티 코드에 사용 중 (코드베이스 표준)
- ➕ = 사전·코드 모두 없음 → **신규 도입** (사용자 검토 대상)

| 약어 | 의미 | 출처 |
|---|---|---|
| `MNG` | 관리 | ✅ (`관리: MNG`) |
| `NO` | 번호 | ✅ (`번호: NO`) |
| `SNO` | 일련번호 | 🔧 (`BG_SNO`, `IT_MNGC_SNO`) |
| `NM` | 명/이름 | ✅ (`명: NM`) |
| `TP` | 유형 | 🔧 (`PRJ_TP`, `IVG_TP`) |
| `CONE` | 내용 | ✅ (`내용: CONE`) |
| `DTM` | 일시 | ✅ (`일시: DTM`) |
| `USR` | 사용자 | ✅ (`사용자: USR`) |
| `GRP` | 그룹 | ✅ (`그룹: GRP`) |
| `BICE` | 담당 | ✅ |
| `KD` | 종류 (카테고리) | ✅ (`종류: KD`) |
| `RMK` | 비고 | 🔧 (코드베이스 표준) |
| `USE` | 사용 | ✅ (`사용: USE`) |
| `BBR` | 부점(담당부서) | ✅ (`부점: BBR`) |
| `FL` | 파일 | ✅ (`파일: FL`) |
| `STT` | 시작 | ✅ (`시작: STT`) |
| `END` | 종료 | ✅ (`종료: END`) |
| `YMD` | 년월일 | 🔧 (`PLN_YY` 류와 동급, 일자 표준) |
| `INQ` | 조회 | ✅ (`조회: INQ`) |
| `NBR` | 수/횟수 | ✅ (`수: NBR`) |
| `BLB` | 게시판 (Billboard) | ✅ (`게시판: BLB`) |
| `REP` | 답변 (Immediate Reply) | ✅ (`답변: REP`) |
| `ESN` | 필수 (Essentiality) | ✅ (`필수: ESN`) |
| `FXN` | 고정 (Fixing) | ✅ (`고정: FXN`) |
| `ATH` | 권한 (Authority) | ✅ (`권한: ATH`) |
| `ENR` | 등록 (Enrollment) | ✅ (`등록: ENR`) |
| `LMTN` | 한정 (Limitation) | ✅ (`한정: LMTN`) |
| `SRE` | 화면 (Screen) | ✅ (`화면: SRE`) |
| `SQN` | 순서 (Sequence) | ✅ (`순서: SQN`) |
| `PRIT` | 중요도 (Priority) | ✅ (`중요도: PRIT`) |
| `APG` | 첨부 (Appending) | ✅ (`첨부: APG`) |
| `HRK` | 상위 (Highrank) | ✅ (`상위: HRK`) |
| `LEV` | 레벨 (Level) | ✅ (`레벨: LEV`) |
| `NAC` | 게시물 (Notice Article) | ✅ (`게시물: NAC`) |
| `CMMT` | 댓글 (Comment) | ✅ (`댓글: CMMT`) |

> `LV`는 META 표준단어에서 **이탈(Leave)**을 의미하므로 레벨 컬럼에 사용하지 않는다. 레벨은 `LEV(Level)`를 사용한다.

> `PRLM`은 META 표준단어에서 **인사(Personnel Matters)**를 의미하므로, 본 스펙에서 "상위(parent)" 용도로 사용하지 않는다. 기존 코드베이스의 `PRLM_HRK_OGZ_C_CONE` 등은 인사 도메인 컬럼이며, 게시판 부모-자식 관계는 `HRK_*` prefix를 사용한다.

### 3.2 `TPRMPP_CBLBMM` (게시판 메타)

| 표준용어(Comment) | 컬럼명 | 타입 | NULL | 기본값 | 비고/예시 |
|---|---|---|---|---|---|
| 게시판관리번호 | `BLB_MNG_NO` | `VARCHAR2(32)` | NO | — | **PK**. `BLBM-2026-0001` |
| 게시판명 | `BLB_NM` | `VARCHAR2(100)` | NO | — | "공지사항", "자료실" |
| 게시판유형 | `BLB_TP` | `VARCHAR2(32)` | NO | — | `BLB_TP_001`=공지/`002`=자료실 |
| 답변사용여부 | `REP_USE_YN` | `VARCHAR2(1)` | NO | `'N'` | Y/N |
| 댓글사용여부 | `CMMT_USE_YN` | `VARCHAR2(1)` | NO | `'N'` | Y/N |
| 첨부필수여부 | `FL_ESN_YN` | `VARCHAR2(1)` | NO | `'N'` | Y/N |
| 상위고정사용여부 | `HRK_FXN_USE_YN` | `VARCHAR2(1)` | NO | `'N'` | Y/N |
| 게시물유형사용여부 | `NAC_TP_USE_YN` | `VARCHAR2(1)` | NO | `'N'` | Y면 작성 화면에 유형 선택 활성 |
| 종류사용여부 | `KD_USE_YN` | `VARCHAR2(1)` | NO | `'N'` | 카테고리 사용 여부 |
| 조회권한코드 | `INQ_ATH_C` | `VARCHAR2(32)` | NO | `'ALL'` | `ALL`/`ROLE_ADMIN`/`ROLE_*` |
| 등록권한코드 | `ENR_ATH_C` | `VARCHAR2(32)` | NO | `'ALL'` | 동일 |
| 담당부서한정사용여부 | `BBR_LMTN_USE_YN` | `VARCHAR2(1)` | NO | `'N'` | Y면 본문 `BBR_C` 활성 |
| 담당부서한정코드 | `BBR_LMTN_C` | `VARCHAR2(8)` | YES | NULL | 게시판 단위 부서 제한 |
| 화면순서번호 | `SRE_SQN_NO` | `NUMBER(3)` | NO | `0` | 사이드바 정렬 |
| 사용여부 | `USE_YN` | `VARCHAR2(1)` | NO | `'Y'` | N=숨김 |
| 비고 | `RMK` | `VARCHAR2(500)` | YES | NULL | 운영자 메모 |
| **공통** | — | — | — | — | **`BaseEntity` 상속** |

### 3.3 `TPRMPP_CBLBCM` (게시판 본문 = 게시물)

| 표준용어(Comment) | 컬럼명              | 타입              | NULL | 기본값            | 비고/예시                                           |
| ------------- | ---------------- | --------------- | ---- | -------------- | ----------------------------------------------- |
| 게시물관리번호       | `NAC_MNG_NO`     | `VARCHAR2(32)`  | NO   | —              | **PK**. `NAC-2026-0001`                         |
| 게시판관리번호       | `BLB_MNG_NO`     | `VARCHAR2(32)`  | NO   | —              | FK → `CBLBMM.BLB_MNG_NO`                        |
| 게시물명          | `NAC_NM`         | `VARCHAR2(300)` | NO   | —              | 제목                                              |
| 게시물내용         | `NAC_CONE`       | `CLOB`          | YES  | —              | Tiptap HTML, sanitize 의무                        |
| 게시물조회수        | `NAC_INQ_NBR`    | `NUMBER(10)`    | NO   | `0`            | 조회 카운터                                          |
| 게시물유형         | `NAC_TP`         | `VARCHAR2(32)`  | YES  | NULL           | `NAC_TP_001`=작업예정 등                             |
| 종류코드          | `KD_C`           | `VARCHAR2(32)`  | YES  | NULL           | 메타 `KD_USE_YN='Y'`일 때 (카테고리)                    |
| 중요도코드         | `PRIT_C`         | `VARCHAR2(32)`  | NO   | `'PRIT_C_001'` | `001`=일반/`002`=중요/`003`=긴급                      |
| 상위고정여부        | `HRK_FXN_YN`     | `VARCHAR2(1)`   | NO   | `'N'`          | Y/N                                             |
| 화면여부          | `SRE_YN`         | `VARCHAR2(1)`   | NO   | `'Y'`          | 노출 토글 (즉시 비공개)                                  |
| 담당부서코드        | `BBR_C`          | `VARCHAR2(8)`   | YES  | NULL           | 공개 대상 부서. 메타 `BBR_LMTN_USE_YN='Y'`일 때 (NULL=전체) |
| 시작일자          | `STT_YMD`        | `DATE`          | YES  | NULL           | 공개 시작일 (NULL=즉시)                                |
| 종료일자          | `END_YMD`        | `DATE`          | YES  | NULL           | 공개 종료일 (NULL=무기한)                               |
| 파일첨부여부        | `FL_APG_YN`      | `VARCHAR2(1)`   | NO   | `'N'`          | UI 아이콘용 캐시                                      |
| 파일수           | `FL_NBR`         | `NUMBER(4)`     | NO   | `0`            | 첨부파일 개수, 목록 N+1 회피 캐시                           |
| 게시물그룹번호       | `NAC_GRP_NO`     | `VARCHAR2(32)`  | NO   | —              | 최상위 글의 PK; 자기 자신이 최상위면 자기 PK                    |
| 게시물그룹순서       | `NAC_GRP_SQN`    | `NUMBER(5)`     | NO   | `0`            | 그룹 내 정렬                                         |
| 게시물그룹레벨       | `NAC_GRP_LEV`    | `NUMBER(2)`     | NO   | `0`            | 0=원글, 1=답, 2=답의답…                               |
| 상위게시물관리번호     | `HRK_NAC_MNG_NO` | `VARCHAR2(32)`  | YES  | NULL           | 직계 부모 PK                                        |
| **공통**        | —                | —               | —    | —              | **`BaseEntity` 상속**                             |

### 3.4 `TPRMPP_CCMMTM` (게시판 댓글)

| 표준용어(Comment) | 컬럼명 | 타입 | NULL | 기본값 | 비고/예시 |
|---|---|---|---|---|---|
| 댓글관리번호 | `CMMT_MNG_NO` | `VARCHAR2(32)` | NO | — | **PK**. `CMMT-2026-0001` |
| 게시물관리번호 | `NAC_MNG_NO` | `VARCHAR2(32)` | NO | — | FK → `CBLBCM.NAC_MNG_NO` |
| 댓글내용 | `CMMT_CONE` | `CLOB` | NO | — | 댓글 본문, sanitize 의무 |
| 화면여부 | `SRE_YN` | `VARCHAR2(1)` | NO | `'Y'` | 노출 토글 |
| 댓글그룹번호 | `CMMT_GRP_NO` | `VARCHAR2(32)` | NO | — | 최상위 댓글 PK; 자기 자신이 최상위면 자기 PK |
| 댓글그룹순서 | `CMMT_GRP_SQN` | `NUMBER(5)` | NO | `0` | 그룹 내 정렬 |
| 댓글그룹레벨 | `CMMT_GRP_LEV` | `NUMBER(2)` | NO | `0` | 0=원댓글, 1=대댓글, 2=대대댓글… |
| 상위댓글관리번호 | `HRK_CMMT_MNG_NO` | `VARCHAR2(32)` | YES | NULL | 직계 부모 댓글 PK |
| **공통** | — | — | — | — | **`BaseEntity` 상속** |

> 댓글은 게시판 메타의 `CMMT_USE_YN='Y'`인 경우에만 활성화. 첨부파일은 1차 미지원 (§1.3 비-스코프).

### 3.5 `TPRMPP_CBLBCL` / `TPRMPP_CBLBML` / `TPRMPP_CCMMTL` (변경 로그)
`BgdocmL`/`BplanmL`과 동일 패턴. `Cblbmm`·`Cblbcm`·`Ccmmtm` 각각에 `@LogTarget(entity = CblbmmL.class)` / `@LogTarget(entity = CblbcmL.class)` / `@LogTarget(entity = CcmmtmL.class)` 부여 → `ChangeLogEntityListener`가 자동 적재.

### 3.6 인덱스 전략

```sql
-- 1. 게시물 목록 조회 (가장 빈번)
CREATE INDEX IDX_CBLBCM_LIST
    ON TPRMPP_CBLBCM (BLB_MNG_NO, DEL_YN, SRE_YN, HRK_FXN_YN DESC, FST_ENR_DTM DESC);

-- 2. 답변글 트리 정렬
CREATE INDEX IDX_CBLBCM_GRP
    ON TPRMPP_CBLBCM (NAC_GRP_NO, NAC_GRP_SQN);

-- 3. 직계 부모 탐색
CREATE INDEX IDX_CBLBCM_HRK
    ON TPRMPP_CBLBCM (HRK_NAC_MNG_NO);

-- 4. 작성자별 글 (마이페이지)
CREATE INDEX IDX_CBLBCM_AUTHOR
    ON TPRMPP_CBLBCM (FST_ENR_USID, DEL_YN);

-- 5. 부서 한정 게시물 필터
CREATE INDEX IDX_CBLBCM_BBR
    ON TPRMPP_CBLBCM (BBR_C);

-- 6. 게시판 메타 사이드바 정렬
CREATE INDEX IDX_CBLBMM_NAV
    ON TPRMPP_CBLBMM (USE_YN, SRE_SQN_NO);

-- 7. 댓글 목록 (게시물별)
CREATE INDEX IDX_CCMMTM_LIST
    ON TPRMPP_CCMMTM (NAC_MNG_NO, DEL_YN, SRE_YN, FST_ENR_DTM);

-- 8. 댓글 트리 정렬
CREATE INDEX IDX_CCMMTM_GRP
    ON TPRMPP_CCMMTM (CMMT_GRP_NO, CMMT_GRP_SQN);

-- 9. 직계 부모 댓글 탐색
CREATE INDEX IDX_CCMMTM_HRK
    ON TPRMPP_CCMMTM (HRK_CMMT_MNG_NO);
```

> 본문 검색(`NAC_CONE LIKE '%키워드%'`)은 1차 풀스캔 허용. 게시판당 1만 건 초과 또는 검색 응답 1초 초과 시 Oracle Text 인덱스 별도 과제로 추진.

### 3.7 시드 데이터 (예시)

```sql
-- 1) 공통코드: 게시판유형 (BLB_TP)
INSERT INTO TPRMPP_CCODEM VALUES ('BLB_TP', 'BLB_TP_001', '공지사항', 1, 'Y', ...);
INSERT INTO TPRMPP_CCODEM VALUES ('BLB_TP', 'BLB_TP_002', '자료실',   2, 'Y', ...);

-- 2) 공통코드: 중요도 (PRIT_C)
INSERT INTO TPRMPP_CCODEM VALUES ('PRIT_C', 'PRIT_C_001', '일반', 1, 'Y', ...);
INSERT INTO TPRMPP_CCODEM VALUES ('PRIT_C', 'PRIT_C_002', '중요', 2, 'Y', ...);
INSERT INTO TPRMPP_CCODEM VALUES ('PRIT_C', 'PRIT_C_003', '긴급', 3, 'Y', ...);

-- 3) 공통코드: 게시물유형 (NAC_TP)
INSERT INTO TPRMPP_CCODEM VALUES ('NAC_TP', 'NAC_TP_001', '작업예정', 1, 'Y', ...);
INSERT INTO TPRMPP_CCODEM VALUES ('NAC_TP', 'NAC_TP_002', '작업완료', 2, 'Y', ...);
INSERT INTO TPRMPP_CCODEM VALUES ('NAC_TP', 'NAC_TP_003', '교육자료', 3, 'Y', ...);

-- 4) 게시판 메타 시드: 공지사항 (관리자 등록, 답변X, 댓글X, 상위고정 사용, 유형X)
INSERT INTO TPRMPP_CBLBMM (
    BLB_MNG_NO, BLB_NM, BLB_TP,
    REP_USE_YN, CMMT_USE_YN, FL_ESN_YN, HRK_FXN_USE_YN, NAC_TP_USE_YN, KD_USE_YN,
    INQ_ATH_C, ENR_ATH_C, BBR_LMTN_USE_YN,
    SRE_SQN_NO, USE_YN, DEL_YN, GUID, GUID_PRG_SNO,
    FST_ENR_DTM, FST_ENR_USID
) VALUES (
    'BLBM-2026-0001', '공지사항', 'BLB_TP_001',
    'N', 'N', 'N', 'Y', 'N', 'N',
    'ALL', 'ROLE_ADMIN', 'N',
    1, 'Y', 'N', SYS_GUID(), 1,
    SYSDATE, 'SYSTEM'
);

-- 5) 게시판 메타 시드: 자료실 (전체 등록, 답변X, 댓글O, 첨부 필수, 카테고리O, 유형X)
INSERT INTO TPRMPP_CBLBMM (
    BLB_MNG_NO, BLB_NM, BLB_TP,
    REP_USE_YN, CMMT_USE_YN, FL_ESN_YN, HRK_FXN_USE_YN, NAC_TP_USE_YN, KD_USE_YN,
    INQ_ATH_C, ENR_ATH_C, BBR_LMTN_USE_YN,
    SRE_SQN_NO, USE_YN, DEL_YN, GUID, GUID_PRG_SNO,
    FST_ENR_DTM, FST_ENR_USID
) VALUES (
    'BLBM-2026-0002', '자료실', 'BLB_TP_002',
    'N', 'Y', 'Y', 'N', 'N', 'Y',
    'ALL', 'ALL', 'N',
    2, 'Y', 'N', SYS_GUID(), 1,
    SYSDATE, 'SYSTEM'
);
```

---

## 4. 답변글·댓글 그룹 알고리즘

> 답변글(`NAC_GRP_*`)과 댓글(`CMMT_GRP_*`)은 **동일한 그룹+순서+레벨 3컬럼 패턴**을 사용한다. 아래는 답변글 기준 표기이며, 댓글은 `NAC_*` → `CMMT_*`, `HRK_NAC_MNG_NO` → `HRK_CMMT_MNG_NO`, `NAC_GRP_LEV` → `CMMT_GRP_LEV`로 치환하여 그대로 적용한다.

### 4.1 원글 등록
```
NAC_GRP_NO       := 자기 PK (NAC_MNG_NO)
NAC_GRP_SQN      := 0
NAC_GRP_LEV      := 0
HRK_NAC_MNG_NO   := NULL
```

### 4.2 답변글 등록
부모 글의 `(NAC_GRP_NO, NAC_GRP_SQN, NAC_GRP_LEV)` 조회 후:
```
1. 같은 그룹의 후속 글들(NAC_GRP_SQN > 부모.NAC_GRP_SQN)을 찾아
   같은 또는 더 얕은 깊이로 들여쓰여 있을 때까지의 SQN을 +1 (UPDATE)
2. 새 답변:
   NAC_GRP_NO       := 부모.NAC_GRP_NO
   NAC_GRP_SQN      := 부모.NAC_GRP_SQN + 1
   NAC_GRP_LEV      := 부모.NAC_GRP_LEV + 1
   HRK_NAC_MNG_NO   := 부모.NAC_MNG_NO
```

### 4.3 트리 정렬 쿼리
```sql
SELECT *
  FROM TPRMPP_CBLBCM
 WHERE BLB_MNG_NO = :blbMngNo
   AND DEL_YN = 'N'
   AND SRE_YN = 'Y'
   AND (STT_YMD IS NULL OR STT_YMD <= TRUNC(SYSDATE))
   AND (END_YMD IS NULL OR END_YMD >= TRUNC(SYSDATE))
 ORDER BY HRK_FXN_YN DESC,
          NAC_GRP_NO DESC,    -- 그룹 단위 묶음, 최신 그룹 위
          NAC_GRP_SQN ASC;    -- 그룹 내 트리 순서
```

> SQN 재정렬은 단일 트랜잭션 + `NAC_GRP_NO`(또는 `CMMT_GRP_NO`) 행 단위 비관적 락 (`SELECT ... FOR UPDATE`).

### 4.4 댓글 트리 정렬 쿼리
```sql
SELECT *
  FROM TPRMPP_CCMMTM
 WHERE NAC_MNG_NO = :nacMngNo
   AND DEL_YN = 'N'
   AND SRE_YN = 'Y'
 ORDER BY CMMT_GRP_NO ASC,    -- 댓글 그룹은 작성 순서대로 (오래된 것 위)
          CMMT_GRP_SQN ASC;   -- 그룹 내 트리 순서
```

> 댓글은 게시물과 달리 `CMMT_GRP_NO ASC`(오래된 댓글이 위)가 일반적인 UX. 게시판 메타에서 정렬 방향을 옵션화할 수도 있으나 1차 단순 적용.

---

## 5. 권한·가시성 매트릭스

### 5.0 권한 코드 매핑 (기존 RBAC 추종 — `it_backend/CLAUDE.md` §5.6)
| 메타 권한 코드 값 | 의미 | 기존 RBAC 매핑 |
|---|---|---|
| `ALL` | 전체 사용자 | 모든 인증 사용자 |
| `ROLE_ADMIN` | 관리자 | `ITPAD001` (시스템관리자) |
| `ROLE_USER` | 일반사용자 | `ITPZZ001` |
| `ROLE_PLAN` | 기획통할담당자 | `ITPZZ002` |

### 5.1 작성 권한
```
canWrite(user, board) :=
    user.hasRole('ROLE_ADMIN')
    OR board.ENR_ATH_C = 'ALL'
    OR user.hasRole(board.ENR_ATH_C)
```

### 5.2 게시판 단위 읽기 권한
```
canReadBoard(user, board) :=
    user.hasRole('ROLE_ADMIN')
    OR (
        (board.INQ_ATH_C = 'ALL' OR user.hasRole(board.INQ_ATH_C))
        AND (board.BBR_LMTN_C IS NULL OR user.bbrC = board.BBR_LMTN_C)
    )
```

### 5.3 게시물 단위 가시성
```
canReadPost(user, post, board) :=
    canReadBoard(user, board)
    AND post.DEL_YN = 'N'
    AND (
        user.hasRole('ROLE_ADMIN')
        OR (
            post.SRE_YN = 'Y'
            AND (post.STT_YMD IS NULL OR post.STT_YMD <= TODAY)
            AND (post.END_YMD IS NULL OR post.END_YMD >= TODAY)
            AND (
                board.BBR_LMTN_USE_YN = 'N'
                OR post.BBR_C IS NULL
                OR user.bbrC = post.BBR_C
            )
        )
    )
```

### 5.4 수정·삭제 권한
```
canModify(user, post) :=
    user.hasRole('ROLE_ADMIN')
    OR user.usid = post.FST_ENR_USID
```
삭제는 항상 Soft Delete (`BaseEntity.delete()` → `DEL_YN='Y'`).

### 5.5 답변글 작성 추가 제약
- 부모 글이 `DEL_YN='Y'`이거나 `canReadPost(user, parent)=false`이면 답변 불가
- 게시판 메타의 `REP_USE_YN='N'`이면 답변 불가

### 5.6 댓글 권한
```
canWriteComment(user, post, board) :=
    canReadPost(user, post, board)
    AND board.CMMT_USE_YN = 'Y'

canWriteCommentReply(user, parentComment, post, board) :=
    canWriteComment(user, post, board)
    AND parentComment.DEL_YN = 'N'
    AND parentComment.SRE_YN = 'Y'

canModifyComment(user, comment) :=
    user.hasRole('ROLE_ADMIN')
    OR user.usid = comment.FST_ENR_USID
```
댓글 삭제도 Soft Delete. 자식 댓글이 있는 부모 댓글을 삭제하면 본문은 "삭제된 댓글입니다"로 표시하고 트리 구조는 유지한다.

---

## 6. 첨부파일 연결 규칙

| 항목 | 값 |
|---|---|
| `Cfilem.ORC_DTT` | `"공통게시판"` (단일값) |
| `Cfilem.ORC_PK_VL` | `NAC_MNG_NO` |
| 다운로드 권한 | `canReadPost(user, post)` 통과 시 허용 |
| `FL_APG_YN` / `FL_NBR` 동기화 | 첨부 등록·삭제 시 게시물 캐시 업데이트 |

`FileOwnershipChecker`를 확장하여 `ORC_DTT="공통게시판"`인 경우 `canReadPost`를 호출하도록 한다.

> **댓글 첨부 1차 미지원**: 댓글(`CCMMTM`)에는 `Cfilem` 연결을 두지 않는다. 짧은 텍스트 본문만 허용. 향후 요구 발생 시 `ORC_DTT="공통게시판댓글"` 별도 값으로 확장 가능.

---

## 7. 보안·검증 체크리스트

- [ ] `NAC_NM`, `NAC_CONE` 입력값 길이 검증 (제목 300자, 본문 한도 §13)
- [ ] `HtmlSanitizer.sanitize()`를 등록·수정 진입 시점에 의무 호출
- [ ] DB 저장 전 본문 길이 (sanitize 결과) 재검증
- [ ] `BBR_C`는 사용자가 자기 부서 또는 NULL만 지정 가능 (관리자 제외)
- [ ] `NAC_INQ_NBR` 카운트는 동일 사용자×동일 게시물 1시간당 1회 (1차 메모리, 분산 시 Redis)
- [ ] 권한 검증은 컨트롤러 + 서비스 이중 적용 (CLAUDE.md §5.6)
- [ ] 첨부 다운로드 시 `canReadPost` 검증
- [ ] 답변글 트리 갱신은 단일 트랜잭션 + 행 단위 락
- [ ] `@LogTarget`으로 모든 수정·삭제 이력 자동 적재 (게시물·댓글 모두)
- [ ] `CMMT_CONE` 길이 검증 (1차: 2,000자 한도 권장 — §13 오픈이슈)
- [ ] `CMMT_CONE`도 `HtmlSanitizer.sanitize()` 통과 (단순 텍스트라도 XSS 방지)
- [ ] 댓글 트리 갱신도 단일 트랜잭션 + 행 단위 락
- [ ] 댓글 작성·수정 시 `canWriteComment` / `canModifyComment` 검증

---

## 8. API 설계 (요약)

> 상세 DTO는 `BoardDto.ListItem`, `Detail`, `CreateRequest`, `UpdateRequest`, `ReplyCreateRequest` 정적 중첩 클래스 (CLAUDE.md §5.3).

### 8.1 게시판 메타
| 메서드 | 경로 |
|---|---|
| `GET` | `/api/boards/meta` |
| `GET` | `/api/boards/meta/{blbMngNo}` |
| `POST` | `/api/admin/boards/meta` |
| `PUT` | `/api/admin/boards/meta/{blbMngNo}` |
| `DELETE` | `/api/admin/boards/meta/{blbMngNo}` |

### 8.2 게시물
| 메서드 | 경로 |
|---|---|
| `GET` | `/api/boards/{blbMngNo}/posts` |
| `GET` | `/api/boards/{blbMngNo}/posts/{nacMngNo}` |
| `POST` | `/api/boards/{blbMngNo}/posts` |
| `PUT` | `/api/boards/{blbMngNo}/posts/{nacMngNo}` |
| `DELETE` | `/api/boards/{blbMngNo}/posts/{nacMngNo}` |
| `POST` | `/api/boards/{blbMngNo}/posts/{nacMngNo}/replies` |

### 8.3 댓글
| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/boards/{blbMngNo}/posts/{nacMngNo}/comments` | 트리 정렬 목록 |
| `POST` | `/api/boards/{blbMngNo}/posts/{nacMngNo}/comments` | 신규 댓글 |
| `POST` | `/api/boards/{blbMngNo}/posts/{nacMngNo}/comments/{cmmtMngNo}/replies` | 대댓글 |
| `PUT` | `/api/boards/{blbMngNo}/posts/{nacMngNo}/comments/{cmmtMngNo}` | 수정 |
| `DELETE` | `/api/boards/{blbMngNo}/posts/{nacMngNo}/comments/{cmmtMngNo}` | Soft Delete |

### 8.4 검색·필터 파라미터
- `keyword` — 제목/본문/작성자 (1차 LIKE)
- `nacTp` — 게시물유형 (메타 `NAC_TP_USE_YN='Y'`인 게시판에서만 유효)
- `kdC` — 카테고리 (종류코드)
- `pritC` — 중요도
- `enrDtmFrom`, `enrDtmTo` — 등록일(FST_ENR_DTM) 범위
- `bbrC` — 부서 필터 (CLAUDE.md §5.14 표준 패턴)
- 페이징: `page`, `size`, `sort`
- 기본 정렬: `(HRK_FXN_YN DESC, FST_ENR_DTM DESC)` — 상위고정 우선, 그다음 최신순. 답변글 그룹 보존 시 §4.3 정렬과 함께 사용.

---

## 9. 프론트엔드 설계 (요약)

### 9.1 라우팅
```
/board                              # 게시판 인덱스
/board/[blbMngNo]                   # 게시물 목록
/board/[blbMngNo]/[nacMngNo]       # 게시물 상세
/board/[blbMngNo]/form              # 신규 작성
/board/[blbMngNo]/[nacMngNo]/edit  # 수정
/admin/boards                       # 게시판 메타 관리 (관리자)
```

### 9.2 컴포넌트 재사용
- 목록: `StyledDataTable`
- 상세 본문: 기존 Tiptap 뷰어
- 작성·수정: 기존 Tiptap 에디터 + DOMPurify
- 첨부: 기존 파일 업로드/다운로드 (`orcDtt="공통게시판"`)
- 댓글: 신규 `BoardCommentTree.vue` 컴포넌트 — 게시물 상세 화면 하단에 배치, 들여쓰기로 트리 표현, 인라인 작성·수정·삭제·대댓글

### 9.3 사이드바 메뉴
- TOP 메뉴 "게시판" 클릭 시 `/api/boards/meta` 응답으로 사이드바 동적 생성
- `USE_YN='Y'` + `canReadBoard(user, board)` 통과만 노출
- `SRE_SQN_NO` 기준 정렬

---

## 10. 변경 이력 (`@LogTarget`)

`Cblbmm`·`Cblbcm`·`Ccmmtm` 각각에 `@LogTarget` 부여. `ChangeLogEntityListener`가 자동 INSERT/UPDATE/DELETE 감지 후 `TPRMPP_CBLBML`/`TPRMPP_CBLBCL`/`TPRMPP_CCMMTL`에 적재.

---

## 11. TASK.md 등록 예정 과제
1. `Bgdocm.docCone` BLOB → CLOB 마이그레이션 (게시판 도입 후 일관성 회복)
2. 본문 검색 Oracle Text 인덱스 도입 (1만 건/1초 초과 시)
3. 조회수 카운터 Redis 전환 (다중 인스턴스 운영 시)
4. 알림(메일/슬랙) 연동 — 공지·중요 게시물 등록 시, 본인 게시물에 댓글 달릴 때
5. 첨부파일 다운로드 카운트 컬럼 (`FL_DWN_NBR`) — 자료실 인기 자료 통계
6. 댓글 첨부파일 지원 (요구 발생 시 — `ORC_DTT="공통게시판댓글"` 추가)

---

## 12. 검증 계획
- 단위 테스트: 답변글·댓글 공통 그룹 알고리즘, 권한 매트릭스 모든 분기, sanitizer
- 통합 테스트: API 권한·가시성 시나리오 (관리자/일반/부서 한정), 댓글 작성·수정·삭제·대댓글
- E2E (Playwright): 공지 등록→답변→수정→삭제, 자료실 첨부 업로드→다운로드, 댓글+대댓글 트리, 부서 한정 공지 가시성
- 부하: 게시판 1만 건 + 게시물 10만 건 + 댓글 50만 건 시드, 목록·상세·검색 p95
- 보안: XSS 페이로드 sanitize 검증 (게시물 본문 + 댓글 본문 모두)

---

## 13. 오픈 이슈
- **본문 최대 크기**: 정책상 한도 (예: 1MB) 필요 여부
- **댓글 최대 크기**: 1차 2,000자 권장 — 확정 필요
- **검색 키워드 최소 길이**: 최소 2자 강제 권장
- **답변글·댓글 최대 깊이**: 무제한 vs UI 5단계 캡
- **공지사항 정책**: 시드 `REP_USE_YN='N'` + `CMMT_USE_YN='N'` (관리자 일방 안내) 정책 확인 필요
- **자료실 정책**: 시드 `REP_USE_YN='N'` + `CMMT_USE_YN='Y'` + `FL_ESN_YN='Y'` 정책 확인 필요
- **삭제된 부모 댓글**: 자식 댓글이 있는 댓글 삭제 시 "삭제된 댓글입니다" 표시 + 자식 보존 (현 설계). 자식까지 cascade 삭제 정책 검토 여부

---

_본 스펙은 `superpowers:brainstorming` 스킬로 작성되었으며, 승인 후 `superpowers:writing-plans`로 단계별 구현 플랜을 생성한다._
