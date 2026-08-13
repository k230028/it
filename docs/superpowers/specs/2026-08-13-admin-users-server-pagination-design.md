# 관리자 사용자 목록 서버 페이징 설계

## 배경

`/admin/users`는 `GET /api/admin/users`로 삭제되지 않은 사용자 전체를 한 번에 조회한다. 내부 개발계 응답은 약 1.7MB였고, 프론트엔드가 모든 행과 행당 여러 `InlineEditCell`을 생성하면 Vue 렌더링 과정에서 `Maximum call stack size exceeded`가 발생한다.

현재 클라이언트 페이징으로 동시 DOM 생성은 50행으로 제한했지만, 초기 접속 때 전체 데이터 조회·전송·JSON 파싱·반응형 변환 비용은 남아 있다. 이 설계는 조회 자체를 서버 페이징으로 변경한다.

## 목표

- 초기 사용자 조회를 기본 50건으로 제한한다.
- 검색·정렬·페이지 이동을 서버 전체 데이터 기준으로 수행한다.
- 현재 페이지의 사용자 편집·저장·삭제 흐름을 유지한다.
- 엑셀 다운로드는 현재 검색·정렬 조건에 해당하는 전체 결과를 유지한다.

## API 계약

### 목록 조회

`GET /api/admin/users`의 응답을 배열에서 Spring Data `Page` 형태로 변경한다.

요청 파라미터:

- `page`: 0부터 시작, 기본 0
- `size`: 기본 50, 허용값 20·50·100·200
- `search`: 선택, 앞뒤 공백 제거 후 대소문자 구분 없이 부분 일치
- `sort`: Spring 형식 `field,direction`; 기본 `eno,asc`

응답의 핵심 필드:

- `content: UserResponse[]`
- `totalElements`
- `totalPages`
- `number`
- `size`

검색 대상:

- 사번 `eno`
- 사용자명 `usrNm`
- 직위 `ptCNm`
- 부점코드·부점명 `bbrC`, `bbrNm`
- 팀코드·팀명 `temC`, `temNm`
- 이메일 `etrMilAddrNm`
- 내선번호 `inleNo`
- 휴대전화 `cpnTpn`

정렬 필드는 화면에 노출된 컬럼의 화이트리스트로 제한한다. 알 수 없는 필드나 방향은 400으로 거절하지 않고 기본 `eno,asc`로 보정해 화면 사용성을 유지한다.

### 엑셀 전체 결과 조회

`GET /api/admin/users/export?search=...&sort=...`를 추가한다. 이 API는 페이징 없이 검색·정렬 조건에 맞는 `UserResponse[]`를 반환하며 사용자가 다운로드를 누를 때만 호출한다. 엑셀 파일 생성은 기존처럼 프론트엔드가 담당한다.

## 백엔드 설계

`UserRepository`에 사용자·조직 LEFT JOIN 조회를 추가한다. 페이징 쿼리는 `Page<AdminUserView>`를 반환하고 별도 `countQuery`로 전체 건수를 얻는다. 조직명을 JOIN 프로젝션에서 바로 반환하여, 현재 페이지별 조직 코드 IN 재조회를 제거한다.

`AdminService`는 검색어 정규화와 정렬 화이트리스트 변환을 담당한다. 목록은 `Page.map`으로 DTO를 변환하고, 엑셀용 조회는 같은 검색 조건과 정렬 규칙을 재사용한다.

`AdminController`는 `@PageableDefault(size = 50, sort = "eno")`와 `search`를 받는다. 과대 페이지로 인한 재발을 막기 위해 `size`는 서비스에서 최대 200으로 보정한다.

## 프론트엔드 설계

`useAdminApi.fetchUsers` 인자를 반응형 `page`, `size`, `search`, `sortField`, `sortOrder`로 확장하고 `AdminPageResponse<AdminUserResponse>`를 반환한다. 파라미터 변경을 `watch` 대상으로 삼아 새 페이지를 조회한다.

`/admin/users` 상태:

- `currentPage = 0`
- `pageSize = 50`
- `search`
- `sortField = 'eno'`
- `sortOrder = 1`
- `users = response.content`
- `totalRecords = response.totalElements`

DataTable은 `lazy`, `first`, `rows`, `totalRecords`를 설정하고 `page`/`sort` 이벤트에서 상태를 변경한다. 검색어는 300ms debounce 후 0페이지로 돌아가 조회한다. 서버가 이미 검색하므로 기존 `filteredUsers` 전체 배열 필터는 제거하고 현재 페이지 또는 편집 배열만 테이블에 전달한다.

## 편집 안전성

편집 모드에 진입하면 현재 페이지의 행만 복제해 수정한다. 편집 중에는 다음 조작을 비활성화한다.

- 페이지 이동·페이지 크기 변경
- 컬럼 정렬
- 검색어 변경

저장 성공 후 현재 검색·정렬·페이징 조건으로 재조회한다. 삭제로 현재 페이지가 비어 있고 0페이지가 아니라면 한 페이지 앞으로 이동해 재조회한다. 취소하면 서버 데이터를 변경하지 않고 현재 페이지를 다시 표시한다.

## 오류 처리

- 초기 또는 페이지 조회 실패: `useRefreshGuard`의 배너·Toast를 유지하고 직전 성공 페이지를 보존한다.
- 엑셀 조회 실패: 다운로드를 시작하지 않고 오류 Toast를 표시한다.
- 빠른 검색·페이지 전환: Nuxt fetch dedupe/취소 결과를 사용해 가장 최신 조건의 응답만 화면에 남긴다.

## 테스트

백엔드:

- Repository: 전체 건수·페이지 경계·조직명 검색·복합 검색·정렬
- Service: 기본 페이징, 최대 200 제한, 정렬 화이트리스트, DTO 변환
- Controller: 페이지 응답 계약과 export 요청 전달

프론트엔드:

- API composable: 반응형 query 전달과 `Page` 응답 타입
- 화면: 초기 50건, 총 건수, 페이지·정렬·검색 서버 요청
- 편집: 편집 중 이동·정렬·검색 차단, 저장 후 재조회
- 엑셀: 현재 검색·정렬 조건의 전체 결과 다운로드
- 회귀: 대량 응답이 한 페이지 범위로 제한되고 refresh guard가 활성 effect scope에서 생성됨

## 비목표

- 사용자 저장 API를 일괄 저장 API로 변경하지 않는다.
- 사용자 테이블의 DB 컬럼이나 Flyway 마이그레이션을 변경하지 않는다.
- 공통 `StyledDataTable`의 기본 동작을 변경하지 않는다.
