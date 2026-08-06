# 게시판을 메뉴관리로 배치 (BRD 메뉴유형) — 설계

- 작성일: 2026-08-06
- 대상: `it_backend`(메뉴 도메인), `it_frontend`(admin/menus), `it_database`(마이그레이션)

## 배경

게시판은 메뉴 테이블에 행이 없다. 고정 노드 `MBRD0001` 아래에 활성 게시판 전체가 서버에서 매 요청
동적으로 붙는다(`BoardListMenuResolver`). 그래서 관리자는

- 특정 게시판을 원하는 헤더·그룹 아래에 놓을 수 없고,
- 게시판 메뉴의 이름·순서·노출권한을 다른 메뉴처럼 다룰 수 없다.

메뉴관리 화면의 화면경로 선택은 라우트 카탈로그(`TPRMPP_CMENUD`)만 보여주는데 `/board/{게시판번호}`는
거기 없으므로, 게시판을 가리키는 메뉴를 만들 수도 없다.

## 목표

게시판 하나가 메뉴 하나가 되어, 일반 메뉴와 똑같이 메뉴관리에서 배치·정렬·권한 설정된다.
동적 확장은 폐지하고 모든 게시판 메뉴를 명시 행으로 관리한다.

## 결정

### 표현 방식 — 새 메뉴유형 `BRD` + 화면경로에 `/board/{게시판번호}`

`SRE_PTH`는 이미 "이 메뉴가 여는 화면 주소"라는 단일 의미를 갖고 있고 `/board/[blbMngNo]` 라우트가
실재하므로, 유형만 추가하면 저장·라우팅·Breadcrumb·탭 제목이 기존 경로를 그대로 탄다.
컬럼 추가(`BLB_MNG_NO`)는 엔티티·DTO·로그 테이블(`TPRMPP_CMENUML`)까지 파급되는 데 비해
얻는 것이 적어 채택하지 않았다. 참조 정합성은 저장 시 서버 검증과 조회 시 활성 게시판 대조로 확보한다.

### 삭제·미사용 게시판 — 사용자 메뉴에서만 자동 숨김

메뉴 행은 남기고 `/api/menus`(사용자 트리)에서만 제외한다. 관리 트리에는 남아 관리자가 다른 게시판으로
바꾸거나 지울 수 있다. 게시판을 실수로 지웠을 때 수작업한 메뉴 배치가 함께 사라지지 않는다.

### 동적 확장 확장점 제거

`BoardListMenuResolver`가 유일한 구현이므로, 이를 지우면 `MenuChildrenResolver`와
`MenuQueryService.hasResolver`/`resolveDyn`은 호출자 없는 코드가 된다. 함께 제거한다.

### 신규 폼에 상위메뉴 선택 추가

지금 신규 생성은 항상 "루트 GRP"로 고정이라, 게시판 메뉴 하나를 만들려면
만들기 → 드래그 이동 → 유형 변경 → 저장의 4단계가 필요하다. 상위메뉴를 폼에서 고르면 한 번에 끝난다.

## 구성

### 1. 데이터 (`it_database/migrations/V20260806_001__AddBoardMenuTypeAndSeedBoardMenus.sql`)

- 공통코드 `MNU_TP_C`에 `BRD`(게시판) 추가, 정렬 4 — 멱등(`WHERE NOT EXISTS`)
- `CK_CMENUM_TP` 제약을 `('GRP','LNK','PGE','BRD')`로 재생성
- 활성 게시판(`TPRMPP_CBLBMM`, `USE_YN='Y' AND DEL_YN='N'`) 전수를 `MBRD0001` 하위 `BRD` 메뉴로 시드
  - `MNU_ID` = `'MNU' || LPAD(SQ_TPRMPP_CMENUM_1.NEXTVAL, 7, '0')`
  - `MNU_NM` = 게시판명, `SRE_PTH` = `'/board/' || BLB_ID`
  - `MNU_DEP` = 3, `WHL_MNU_PTH` = `'/MHED0006/MBRD0001/' || 새 MNU_ID` (현재 동적 노드가 쓰던 값과 동일)
  - `MNU_SOT_SQN_SNO` = 게시판 화면순서(`SRE_SQN_SNO`) 순으로 10, 20, …
  - `GUID`는 `SYS_GUID()`를 UUID 형식으로 변환해 채우고 `GUID_PRG_SNO`=1
  - 이미 같은 `SRE_PTH`의 활성 메뉴가 있으면 건너뛴다(재실행 안전)

적용 직후 화면은 지금과 동일하게 보인다.

### 2. 백엔드

| 대상 | 변경 |
| --- | --- |
| `AdminMenuService.validateTypePath` | 허용 유형에 `BRD` 추가. `BRD`는 화면경로 필수 + `/board/{번호}` 형식 + 활성 게시판 존재 검증. 라우트 카탈로그 검증은 `PGE`만 |
| `MenuQueryService.getMenuTree` | 활성 게시판 경로 집합을 만들어, 집합에 없는 `BRD` 노드를 사용자 트리에서 제외. `getAdminMenuTree`는 그대로 노출 |
| `MenuQueryService` | `resolvers`·`hasResolver`·`resolveDyn` 제거 |
| `BoardListMenuResolver`, `MenuChildrenResolver` | 삭제 |

루트는 여전히 `GRP`만 허용하므로 `BRD`는 루트에 놓을 수 없다(`validateHierarchy` 변경 없음).

### 3. 프론트엔드 (`admin/menus/index.vue`)

- 유형이 `BRD`면 화면경로 Select 대신 **게시판 Select**(활성 게시판 목록)를 띄운다. 고르면 화면경로를
  `/board/{번호}`로 채우고, 메뉴명이 비어 있으면 게시판명으로 채운다
- 신규 폼에 **상위메뉴 Select**를 추가한다. `(최상위)`를 고르면 종전처럼 루트 `GRP`로 저장된다
- 유형을 바꾸면 화면경로를 초기화해 이전 유형의 경로가 남지 않게 한다
- 관리 트리에서 활성 게시판에 연결되지 않은 `BRD` 노드에는 `연결된 게시판 없음`을 표시한다
- `admin/boards/index.vue`에 "게시판을 만든 뒤 메뉴관리에서 배치해야 메뉴에 노출됩니다" 안내 한 줄

## 오류 처리

- 없는 게시판·형식 위반 경로는 400과 한글 사유로 거부하고, 화면은 기존 저장 실패 토스트로 표시한다
- 게시판 목록 조회가 실패하면 게시판 Select가 비고, 유형 코드 조회 실패와 같은 방식으로 안내한다
- 메뉴 저장 후 재조회 실패 판정은 기존 `useRefreshGuard` 배선을 그대로 사용한다(ERR-13)

## 테스트

- 백엔드 `AdminMenuServiceTest`: `BRD` 저장 성공, 경로 없음, 형식 위반, 없는 게시판, 라우트 카탈로그 미조회
- 백엔드 `MenuQueryServiceTest`: 활성 게시판 `BRD` 노출 / 비활성·삭제 게시판 `BRD` 사용자 트리 제외 /
  관리 트리에는 유지. 기존 resolver 테스트는 제거
- 프론트 `admin/menus`: 유형 `BRD` 선택 시 게시판 Select 노출과 저장 본문(`srePth`), 메뉴명 자동 채움,
  상위메뉴 선택 저장, 연결 없는 `BRD` 노드 표시
- 마이그레이션은 로컬 Flyway 적용으로 확인

## 영향과 후속

- 새 게시판을 만들어도 메뉴에 자동으로 뜨지 않는다. 관리자가 메뉴관리에서 배치해야 한다
- `/board` 목록 페이지는 그대로 유지한다
- dev/prod DB 적용은 DBA가 수행한다
