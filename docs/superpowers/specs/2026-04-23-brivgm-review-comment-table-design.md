# TPRMPP_BRIVGM 검토의견 테이블 설계

- **작성일:** 2026-04-23
- **대상 화면:** `/info/documents/{id}/review`
- **관련 테이블:** TPRMPP_BRDOCM (문서), 공통 첨부파일 테이블

---

## 1. 배경

`/info/documents/{id}/review` 화면에서 검토자가 문서 본문에 달 수 있는 검토의견(코멘트)이 현재 프론트엔드 Pinia 스토어에 메모리 전용으로 관리되고 있다. 새로고침 시 초기화되는 한계를 해소하기 위해 DB 테이블을 신설한다.

---

## 2. 테이블 정의

### 테이블명: `TPRMPP_BRIVGM` (검토의견)

| 화면 표기명 | 표준용어(Comment) | 컬럼명 | 타입 | 비고 |
|---|---|---|---|---|
| 검토의견일련번호 | 검토의견일련번호 | IVG_SNO | VARCHAR2(32) | 기본키 |
| 문서관리번호 | 문서관리번호 | DOC_MNG_NO | VARCHAR2(32) | FK → TPRMPP_BRDOCM |
| 문서버전 | 문서버전 | DOC_VRS | NUMBER(5,2) | FK → TPRMPP_BRDOCM |
| 의견유형 | 의견유형 | IVG_TP | VARCHAR2(1) | `I`=인라인, `G`=전반 |
| 검토내용 | 검토내용 | IVG_CONE | CLOB | 코멘트 본문 |
| 마크ID | 마크ID | MARK_ID | VARCHAR2(64) | 인라인 전용, nullable |
| 인용내용 | 인용내용 | QTD_CONE | VARCHAR2(4000) | 선택 텍스트 스냅샷, nullable |
| 해결여부 | 해결여부 | RSLV_YN | VARCHAR2(1) | `Y`=해결, `N`=미해결 |
| 삭제여부 | 삭제여부 | DEL_YN | VARCHAR2(1) | 공통 컬럼 |
| 최초생성시간 | 최초생성시간 | FST_ENR_DTM | DATE | 공통 컬럼 |
| 최초생성자 | 최초생성자 | FST_ENR_USID | VARCHAR2(14) | 공통 컬럼 |
| GUID | 일련번호 | GUID | VARCHAR2(38) | 공통 컬럼 |
| GUID진행일련번호 | 일련번호2 | GUID_PRG_SNO | NUMBER(4,0) | 공통 컬럼 |
| 마지막수정시간 | 마지막수정시간 | LST_CHG_DTM | DATE | 공통 컬럼 |
| 마지막수정자 | 마지막수정자 | LST_CHG_USID | VARCHAR2(14) | 공통 컬럼 |

---

## 3. 설계 결정 사항

### 3.1 단일 테이블 (인라인 + 전반 통합)

인라인 코멘트(`IVG_TP = 'I'`)와 전반 코멘트(`IVG_TP = 'G'`)를 단일 테이블로 관리한다.

- 인라인 전용 컬럼(`MARK_ID`, `QTD_CONE`)은 `IVG_TP = 'G'`일 때 NULL
- 통합 조회(문서 전체 코멘트 목록) 시 JOIN 불필요

### 3.2 문서 버전 포함

`TPRMPP_BRDOCM`의 복합키(`DOC_MNG_NO + DOC_VRS`)를 모두 저장한다.

- 버전별 코멘트 이력 조회 가능 (`DOC_MNG_NO = 'DOC-2026-0010' AND DOC_VRS = 1.01`)
- 문서가 새 버전으로 갱신되어도 이전 버전의 코멘트는 유지

### 3.3 첨부파일

공통 첨부파일 테이블로 통합 관리한다. 이 테이블에 첨부파일 컬럼을 두지 않는다.

### 3.4 작성자 정보

`FST_ENR_USID`(공통 컬럼)가 작성자 사번을 커버한다. 작성자 이름·팀은 조회 시 사원 테이블 JOIN으로 해결한다.

### 3.5 IVG_CONE 타입: CLOB

코멘트 본문은 순수 텍스트이므로 문자 검색·정렬을 고려해 CLOB을 사용한다.  
시스템 컨벤션상 BLOB 통일이 필요한 경우 BLOB으로 변경 가능.

---

## 4. 컬럼 규칙

| 컬럼 | 허용값 | 제약 |
|---|---|---|
| IVG_TP | `I`, `G` | NOT NULL |
| RSLV_YN | `Y`, `N` | NOT NULL, 기본값 `N` |
| DEL_YN | `Y`, `N` | NOT NULL, 기본값 `N` |
| MARK_ID | Tiptap mark UUID | `IVG_TP = 'I'`일 때만 값, 나머지 NULL |
| QTD_CONE | 선택된 텍스트 | `IVG_TP = 'I'`일 때만 값, 나머지 NULL |

---

## 5. 프론트엔드 매핑

| `ReviewComment` 필드 (프론트) | DB 컬럼 |
|---|---|
| `id` | `IVG_SNO` |
| `type` (`'inline'` / `'general'`) | `IVG_TP` (`'I'` / `'G'`) |
| `text` | `IVG_CONE` |
| `markId` | `MARK_ID` |
| `quotedText` | `QTD_CONE` |
| `resolved` | `RSLV_YN` |
| `authorEno` | `FST_ENR_USID` |
| `attachments` | 공통 첨부파일 테이블 |

---

## 6. 참고

- 연관 문서 테이블: `TPRMPP_BRDOCM` (요구사항 정의서, 복합키: `DOC_MNG_NO + DOC_VRS`)
