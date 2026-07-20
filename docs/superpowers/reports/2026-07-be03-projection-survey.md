# BE-03 잔여 전체 엔티티 로딩 후보 조사 (2026-07)

## 판정 기준

- **명백(이번 구현)**: 읽기 전용 전체 엔티티 로딩이며 다음 중 하나 이상 — DTO 사용 컬럼이 절반 미만, 미사용 LOB·대형 컬럼 포함, 넓은 조인/행 폭이 실행계획 비용을 키움, 호출 빈도가 높은 상세 경로
- **경계선(후속 등록)**: 사용 컬럼 비율이 높고 LOB·넓은 조인이 없으며 호출 빈도·실행계획 비용도 낮은 경우 — 측정 근거와 함께 TASK.md 등록
- **제외**: 이미 프로젝션 적용됨 또는 Dirty Checking에 엔티티 로딩이 필요한 쓰기 경로

### 조사 범위와 계수 방법

- 조사 기준 소스는 백엔드 `chore/be03-be06-projection-javadoc` 브랜치의 `d949cab`이다.
- 지정 검색식의 1차 결과는 복합 검색 116줄/45파일, 파생 조회 검색 120줄/50파일이었다. 세부 텍스트 일치는 `nativeQuery=true` 45줄, `@Query` 62줄, 실행 애너테이션 `@EntityGraph` 3건, `selectFrom` 17줄, `JOIN FETCH` 5줄이었다. `JOIN FETCH` 5줄은 모두 설명·주석이며 실행 JPQL의 명시적 fetch join은 0건이다.
- 표의 전체 컬럼 수는 JPA가 전체 엔티티 로딩 때 선택하는 매핑 컬럼(감사·GUID 포함)을 기준으로 하고, 물리 테이블에만 있는 미매핑 컬럼은 주석으로 분리했다. 사용 컬럼은 응답 DTO 또는 **읽기 응답 조립**이 실제 getter로 소비하는 컬럼 수이며, WHERE 조건 컬럼은 별도로 세지 않았다. `Brdocm`은 매핑 18컬럼/물리 19컬럼(`PRLM_HRK_OGZ_C_CONE` 미매핑)이다. 조인으로 얻는 표시명은 `+조인 n`으로 표기했다.
- 호출 빈도는 코드 호출부와 화면 용도에 따른 정성 판정이다. **높음**은 목록·검색·화면 초기 로드, **중간**은 상세 진입·결재 응답 조립, **낮음**은 관리자·개발 전용 경로다.
- Oracle `EXPLAIN PLAN`은 `CURRENT_SCHEMA=ITPOWN` 세션에서 실행하고 `DBMS_XPLAN.DISPLAY(..., 'BASIC +ROWS +BYTES +COST +PREDICATE')`로 확인했다. 비밀번호는 환경변수로만 주입했고 보고서·스크립트에 저장하지 않았다. 전체/제안 projection SQL을 같은 literal bind 대체값으로 비교한 뒤 모든 계획 기록을 같은 세션에서 `ROLLBACK`했다.
- 로컬 후보 테이블의 통계(`NUM_ROWS`, `AVG_ROW_LEN`, `LAST_ANALYZED`)가 비어 있어 실행계획의 Rows/Bytes는 옵티마이저 추정치다. 따라서 실제 읽기 전용 `COUNT`, 그룹별 최대 건수, 대형 값 길이를 함께 기록했다. 운영 AWR/실행 통계 없이 절대 비용을 일반화하지 않는다.

## 후보 목록

| # | 위치(클래스.메서드) | 조회 방식 | 반환 형태 | 사용/전체 컬럼 | LOB·조인 폭 | 호출 빈도 | 실행계획 요약 | 판정 |
| - | ------------------- | --------- | --------- | -------------- | ----------- | --------- | ------------- | ---- |
| 1 | `BoardPostRepositoryImpl.searchPosts` → `BoardPostService.searchPosts` → `BoardPostDto.ListItem` | QueryDSL `selectFrom(Cblbcm)` | 페이지 다건(1~100) | 14/23 | 미사용 `NAC_CONE` 4,000자 포함, 조인 0 | 높음(게시판 목록) | hash 3214418861, FULL + WINDOW SORT; TABLE FULL 행 추정 Bytes 2,888, 20행 페이지 최상위 Bytes 58,020/Cost 5(analytic 열 포함) | **명백** |
| 2 | `UserRepository.findByBbrC` → `UserService.getUsersByOrganization` → `UserDto.ListResponse` | 파생 조회 + EntityGraph | 부서 다건 | 7/23 +조인 1 | 미사용 암호·`DTS_DTL_CONE` 2,000자, 조직 1 JOIN | 높음(직원 선택) | hash 1258700705, INDEX RANGE + MERGE OUTER, Rows 1/Bytes 1,867/Cost 2 | **명백** |
| 3 | `UserRepositoryImpl.searchByName` → `UserService.searchUsersByName` → `UserDto.ListResponse` | QueryDSL `selectFrom(CuserI)` | 검색 다건 | 7/23 +조인 1 | 미사용 암호·대형 문자열; 조직 LAZY N+1 가능 | 높음(자동완성·멘션) | hash 2075770119, CUSERI FULL, Rows 1/Bytes 1,570/Cost 4, 조직 조회 별도 | **명백** |
| 4 | `UserRepository.findByEno` → `UserService.getUser` → `UserDto.DetailResponse` | 파생 조회 + EntityGraph | 단건 | 11/23 +조인 2 | 암호·역할·감사 미사용, 조직/상위조직 2 JOIN | 중간(사용자 상세) | hash 710862926, PK UNIQUE + NESTED LOOPS OUTER 2회, Rows 1/Bytes 2,164/Cost 3 | **명백** |
| 5 | `UserRepository.findByEnoIn/findAllById` → Admin/Application/Committee/Evaluation/Plan/Schedule/Project/Cost/문서 **응답** 이름·조직 Map | 파생 배치 엔티티 조회 | 다건 | 용도별 1~7/23 | 미사용 암호·대형 문자열, 표시명이 필요한 응답만 조직 JOIN | 높음(목록 응답 조립 공통) | hash 4258768852, PK IN-LIST, Rows 1/Bytes 1,570/Cost 3 | **명백** |
| 6 | `UserRepository.findByEno/findById` → `AdminService.resolveUserName`, Project/Cost `setCodeNames` **응답** 보강 | 파생 단건(EntityGraph/기본 PK 두 변형) | 단건 반복 | 1~2/23 | 전체 사용자 적재; Admin 변형은 불필요한 조직 2 JOIN | 높음(응답 N+1) | 기본 PK Bytes 1,570, EntityGraph hash 710862926/Bytes 2,164/Cost 3 | **명백** |
| 7 | `UserRepository.findAll` → `AdminService.getUsers` → `AdminDto.UserResponse` | 상속 `findAll` | 전체 다건 | 11/23 +조인 1 | 미사용 암호·대형 문자열, 조직 LAZY N+1 | 낮음(관리자) | CUSERI FULL SCAN, Rows 25/Bytes 39,250/Cost 4, 조직 조회 별도 | **명백** |
| 8 | `OrganizationRepository.findAllById` → Application/Project/Cost **응답** 조직명 Map | 상속 PK 배치 | 다건 | 2/13 | LOB 없음, 조인 0 | 높음(목록 응답 조립 공통) | hash 3974003270, PK IN-LIST, Rows 1/Bytes 297/Cost 2 | **명백** |
| 9 | `OrganizationRepository.findById` → Project/Cost `setCodeNames` **응답** 폴백 | 상속 PK 단건 | 단건 반복 | 1/13 | LOB 없음, 조인 0이나 N+1 가능 | 중간~높음 | hash 2808597226, PK UNIQUE, Rows 1/Bytes 297/Cost 1 | **명백** |
| 10 | `BplanmRepository.findAllByDelYnOrderByFstEnrDtmDesc` → `PlanService.getPlans` → `PlanDto.ListResponse` | 파생 목록 | 전체 다건 | 9/19 | 사용 CLOB 1개, 미사용 300~4,000자 텍스트 5개 | 높음(계획 목록) | hash 2291581576, FULL + SORT, Rows 3/Bytes 17,103/Cost 4 | **명백** |
| 11 | `BbugtmRepository.findByBseYyAndDelYn` → `BudgetWorkService.getSummary/getProjectSummary` | 파생 목록 | 연도별 다건 | 6/16 | 사용 `PK_COL_NM` 대형 식별문자열 포함, 조인 0 | 높음(예산작업 초기 로드) | hash 1120597652, FULL, Rows 35/Bytes 294,910/Cost 6 | **명백** |
| 12 | `ProjectItemRepository.findByGclMngNoIn.../findByAbusMngNoIn...` → `BudgetWorkService`·`CouncilService.deriveCurrentYearBudgets` | 파생 배치 | 다건 | 5/26 (`gclMngNo,abusMngNo,ioeC,amt,mplAmt`) | 미사용 대형 문자열, 조인 0 | 높음(요약·협의회 목록) | hash 1982961735, PK/INDEX IN-LIST, Rows 1/Bytes 1,576/Cost 3 | **명백** |
| 13 | `ProjectRepository.findByAbusMngNo...` → `EstimateService.get`, `BudgetWorkService` 존재·이름 보강 | 파생 단건/배치 | 단건·다건 | 1~2/45 | 미사용 1,000자 이상 문자열 11개 | 중간~높음 | 단건 hash 537617361/Bytes 31,545/Cost 1; 배치 hash 2947393899/Cost 3 | **명백-차단**: 배치가 무정렬 `putIfAbsent`라 대표 이름 동등성 검증 불가. 정책 승인 전 Task 13 보류 |
| 14 | `CostRepository.findByCostBgNoInAndDelYn` → `BudgetWorkService.getProjectSummary` + `CostRepresentativeSelector` | 파생 배치 | 다건 | 4/33 (`costBgNo,bgSno,lstYn,cttNm`) | 미사용 업무·감사 컬럼, 조인 0 | 높음(예산작업 초기 로드) | hash 2009769883, PK IN-LIST, Rows 1/Bytes 1,758/Cost 3 | **명백** |
| 15 | `EstimateLineRepository.findBy...AndDelYn` → `EstimateService.get` → `EstimateDto.Detail` | 파생 조회 | 문서별 다건 | 4/13 | 1,000자 `opnnCone`을 응답이 사용; 감사·식별 컬럼 미사용 | 중간(소요예산 상세) | hash 2054273392, PK UNIQUE, Rows 1/Bytes 12,291/Cost 1 | **명백** |
| 16 | `PaymentLineRepository.findBy...AndDelYn` → `PaymentService.get` → `PaymentDto.Detail` | 파생 조회 | 문서별 다건 | 5/14 | 1,000자 의견은 사용, 나머지 감사·식별 컬럼 미사용 | 중간(지급 상세) | hash 2244852779, PK RANGE, Rows 1/Bytes 12,292/Cost 1 | **명백** |
| 17 | `ApplicationMapRepository.findByFntTbNmAndPkColNm...` → Project/Cost **응답** 결재 연결 | 파생 조회(DEL 필터 없음 유지) | 단건 후보·배치 다건 | 3/12 | `PK_COL_NM` 물리 16,000 bytes 사용, 나머지 9개 미사용 | 높음(사업·관리비 응답) | hash 2583179400, INDEX FULL DESC, Rows 1/Bytes 8,196/Cost 1, `LOB_BY_VALUE` | **명백** |
| 18 | `ApplicationRepository.findAllById/findById` → Project/Cost **응답** `ApplicationInfoDto` | 상속 PK 단건/배치 | 다건 | 6/15 | CLOB은 이 경로에서 미사용, 조인 0 | 높음(사업·관리비 응답) | hash 230381884, PK IN-LIST, Rows 1/Bytes 2,866/Cost 1 | **명백** |
| 19 | `ApproverRepository.findByDcdMngNo...` → Application/Project/Cost **응답** 결재자 DTO | 응답 전용 파생 projection 추가(기존 mutation 메서드 유지) | 다건 | 6~7/15 | 2,000자 의견은 사용, 감사·GUID 미사용 | 중간~높음 | hash 3468833582, PK IN-LIST + SORT, Rows 1/Bytes 1,157/Cost 3 | **명백** |
| 20 | `FileRepository.findAll` → `AdminService.getFiles` → `AdminDto.FileResponse` | 상속 `findAll` | 전체 다건 | 6/14 | 미사용 `PK_CONE` 4,000자·저장경로 포함 | 낮음(관리자) | hash 1178941135, FULL, Rows 61/Bytes 267,851/Cost 4 | **명백** |
| 21 | `RefreshTokenRepository.findAll` → `AdminService.getTokens` → `AdminDto.TokenResponse` | 상속 `findAll` | 전체 다건 | 4/14 | 미사용 API 토큰 2,000자, 갱신 조회값만 마스킹 사용 | 낮음(관리자) | hash 867877563, FULL, Rows 14/Bytes 85,708/Cost 4, `LOB_BY_VALUE` | **명백** |
| 22 | `ContractRepositoryImpl.findCurrentWithTargetName` → `ContractService.get` → `ContractDto.Detail` | QueryDSL 엔티티+CASE | 단건 | 14/20 +표시명 1 | LEFT JOIN 2, 요청 300자·계약방법사유 1,000자 사용 | 중간(계약 상세) | hash 492949432, NESTED LOOPS OUTER 2 + HASH UNIQUE, Rows 1/Bytes 3,873/Cost 10 | **명백**(넓은 JOIN/Cost 규칙) |
| 23 | `DeliberationRepositoryImpl.findCurrentWithTargetName` → `DeliberationService.get` → `DeliberationDto.Detail` | QueryDSL 엔티티+CASE | 단건 | 16/22 +표시명 1 | LEFT JOIN 2, 1,000자 필드는 `OPNN_CONE` 1개(그 외 200/300자) | 중간(심의 상세) | hash 2727222238, NESTED LOOPS OUTER 2 + HASH UNIQUE, Rows 1/Bytes 14,476/Cost 10 | **명백**(넓은 JOIN/Cost 규칙) |
| 24 | `EstimateRepository.findBy...` → `EstimateService.get` → `EstimateDto.Detail` | 파생 조회 | 단건 | 7/13 | 요청내용 300자 사용, 조인 0 | 중간(소요예산 상세) | PK RANGE, Rows 1/Bytes 922/Cost 2 | **경계선** |
| 25 | `PaymentRepositoryImpl.findCurrentWithTargetName` → `PaymentService.get` → `PaymentDto.Detail` | QueryDSL 엔티티+CASE | 단건 | 10/16 +표시명 1 | LEFT JOIN 2, 마스터 요청내용은 300자; 1,000자 의견은 `Bpaymt` line | 중간(지급 상세) | hash 3295666622, NESTED LOOPS OUTER 2 + HASH UNIQUE, Rows 1/Bytes 1,645/Cost 10 | **명백**(넓은 JOIN/Cost 규칙) |
| 26 | `ApplicationRepository.findAll/findById` → `ApplicationService.getApplication(s)` → `ApplicationDto.Response` | 상속 전체/PK | 단건·전체 다건 | 8/15 | CLOB 세부정보 사용, 조인 0 | 중간 | FULL/PK, 대표 Rows 1/Bytes 2,866/Cost 2 | **경계선** |
| 27 | `CodeRepositoryCustom` 엔티티 조회 → `CodeService` → `CodeDto.Response`/캐시 소비자 | QueryDSL/JPQL 엔티티 | 단건·다건 | 응답 18/20 | 큰 상세값 2개를 응답이 사용, 캐시 적용 | 중간 | INDEX RANGE, Rows 2/Bytes 6,316/Cost 2 | **경계선** |
| 28 | `GuideDocRepository.findBy...` → `GuideDocService` → `GuideDocDto.Response` | 파생 조회 | 단건·다건 | 8/10 | CLOB 본문 사용 | 낮음~중간 | FULL SCAN, Rows 3/Bytes 8,154/Cost 3 | **경계선** |
| 29 | `BoardMetaRepository`·`BoardCommentRepository` 읽기 → 각 Response DTO | 파생/QueryDSL 엔티티 | 단건·다건 | 각각 다수(절반 초과) | 본문·설정 대형값을 응답이 사용 | 중간 | 메타 PK Rows 2/Bytes 1,764/Cost 1; 댓글 FULL+SORT Rows 1/Bytes 2,177/Cost 4 | **경계선** |
| 30 | `LoginHistoryRepository.findAllByOrderByLgnDtmDesc` → `AdminService.getLoginHistory` | 파생 페이지 | 페이지 다건 | 7/14 | LOB 없음, 사용자명 단건 N+1 별도 | 낮음(관리자) | hash 190441828, FULL + WINDOW SORT, table Rows 1,701/Bytes 1.294M, Temp 1.376M, page Rows 20/Bytes 15,840/Cost 294 | **명백**(page 엔티티+고비용+N+1) |
| 31 | `OrganizationRepository.findAll` → `OrganizationService`·`AdminService.getOrganizations` | 상속 `findAll` | 전체 다건 | 10/13 | LOB 없음, 감사 사용자명 보강 | 중간~낮음 | FULL SCAN, 실제 12건으로 소규모 | **경계선** |
| 32 | `ProjectRepositoryImpl.searchByCondition` → `ProjectService.searchProjects` → `ProjectDto.Response` | QueryDSL `selectFrom(Bprojm)` | 목록 다건 | 대부분/45 | 넓지만 업무·대형 필드를 wide 응답이 소비 | 높음 | FULL SCAN, Rows 21/Bytes 약 646K/Cost 4 | **경계선**(API 계약 분리 필요) |
| 33 | `CostRepositoryImpl.searchByCondition` → `CostService.searchCosts` → `CostDto.Response` | QueryDSL `selectFrom(Bcostm)` | 목록 다건 | 대부분/33 | 업무 필드를 wide 응답이 소비 | 높음 | FULL SCAN, Rows 21/Bytes 36,918/Cost 4 | **경계선**(API 계약 분리 필요) |
| 34 | `CinfmmRepository.findByEnoAndDelYnOrderBy...` → `NotificationService.getInbox` | 파생 페이지 | 페이지 다건 | 엔티티 직접 응답(21/21) | 1,000자 메시지 포함 | 높음(알림함) | FULL + WINDOW SORT, Rows 1/Bytes 4,610/Cost 5, 20건 상위 Bytes 92,640 | **경계선**(응답 계약 선행) |
| 35 | `ServiceRequestDocRepository.findAllByDocMngNoAndDelYnOrderByDocVrsSnoDesc` → `ServiceRequestDocService.getVersionHistory` → `VersionResponse` | 파생 엔티티 조회 | 버전 다건 | 5/18 매핑(물리 19) | 미사용 `REDT_CONE_INF` CLOB 포함, 조인 0 | 중간(문서 버전 이력) | hash 2391463171, INDEX RANGE DESC, Rows 1/Bytes 3,815/Cost 0; 5필드 SQL Bytes 75 | **명백** |

## 상세 근거

### 1. 전체 검색 결과의 분류

- native query 45줄은 시퀀스, `COUNT`, `MAX+1`, 집계 `Object[]`, scalar 또는 이미 봉인된 projection row를 반환했다. native SQL이 엔티티 전체를 hydrate하는 신규 명백 후보는 없었다.
- 실행 JPQL의 명시적 fetch join은 없었다. EntityGraph 3건은 모두 `UserRepository`에 있었고, 운영 조회 후보는 `findByBbrC`, `findByEno` 두 건이다. `findAllByOrderByUsrNmAsc`는 개발 컨트롤러 전용이라 제외했다.
- QueryDSL `selectFrom` 중 전체 엔티티가 읽기 응답으로 이어지는 핵심은 게시글, 사용자 검색, Project/Cost wide 목록, 예산작업 엔티티 조회였다. 생성·수정용 조회는 Dirty Checking 범주로 제외했다. QueryDSL constructor/record 선택은 이미 projection이므로 제외했다.
- 파생 조회는 Repository 반환형을 기준으로 Service와 DTO까지 추적했다. 같은 엔티티 메서드가 쓰기에도 사용되는 경우 메서드 자체를 치환하지 않고, 읽기 호출부에 별도 projection 메서드를 추가해야 한다.

### 2. 명백 후보의 Oracle 근거

- **게시글 목록**: 목록 응답은 본문을 소비하지 않지만 전체 `CBLBCM`을 읽는다. 로컬 활성 행은 1건이고 본문 길이는 2자라 현재 데이터로 절감량을 재현할 수 없으나, 물리 허용 길이 4,000자와 페이지 최대 100건 때문에 구조적으로 목록 projection이 유리하다. TABLE FULL 연산자 행 폭은 Bytes 2,888이고, analytic `RN`을 포함한 20행 VIEW 최상위는 Bytes 58,020이다. 같은 filter/order/page의 14필드 SQL은 동일 hash/Cost 5에서 최상위 Bytes 15,800이었다.
- **사용자 계열**: 로컬 사용자는 25명(활성 23명), 한 부서 최대 7명이다. 부서 목록 계획은 조직 1개를 함께 적재하고, `findByEno` EntityGraph 계획은 `PK_CUSERI` unique scan 뒤 조직과 상위조직을 각각 unique scan한다(계획 해시 `710862926`, Cost 3, Bytes 2,164). 이름만 필요한 호출도 같은 전체 사용자와 2개 조직 조인을 수행한다. 이름 검색은 조직을 fetch하지 않아 DTO 변환 시 별도 LAZY 조회가 생길 수 있다.
- **계획 목록**: 활성 3건의 `REDT_CONE_INF` 실제 길이는 평균 약 29.7K, 최대 약 30.7K였다. 목록 건수 계산에 이 CLOB이 필요하므로 CLOB 자체는 projection에 포함하되, 목록에서 쓰지 않는 5개 텍스트 컬럼을 빼야 한다. 옵티마이저 Bytes 17,103은 실제 CLOB 길이를 반영하지 못한다.
- **예산작업 요약**: `BBUGTM`은 전체 214/활성 64건, 특정 연도 최대 35건이다. `getSummary`와 `getProjectSummary`는 같은 6개 필드만 사용한다. `BITEMM`은 전체 48/활성 46건이며 공유 `ProjectItemBudgetView(gclMngNo, abusMngNo, ioeC, amt, mplAmt)`로 `ProjectBudgetSummaryService`와 BudgetWork 두 소비자를 지원할 수 있다. `BPROJM`은 45컬럼 중 이름/존재만 쓰지만 `findByAbusMngNoInAndDelYn` 결과를 무정렬 `putIfAbsent`로 대표 선택하므로 projection 이후 같은 첫 행을 보장할 수 없다. 이 배치 경로는 결정적 정책 승인 전 차단한다. `BCOSTM` 대표 선택은 `CostRepresentativeSelector`가 실제 사용하는 4필드(`costBgNo,bgSno,lstYn,cttNm`)로 충분하다.
- **4단계 상세의 line**: 로컬 `BESTTM`, `BPAYTM`은 현재 0건이라 실제 반복 건수는 없지만, PK 접근의 추정 행 폭이 각각 12,291/12,292 bytes다. Estimate `opnnCone`과 Payment `opnnCone`은 모두 응답이 사용한다. 읽기 상세에 각각 4/5필드 projection을 별도로 추가하고, soft-delete 복원·동기화 쓰기 메서드는 기존 엔티티 반환을 유지한다.
- **결재 응답 보강**: `CAPPLA`는 로컬 0건이지만 12컬럼 중 3개만 쓰고 `PK_COL_NM`의 물리 길이가 16,000 bytes다. 계획 해시 `2583179400`, INDEX FULL SCAN DESC, Bytes 8,196이며 predicate에 `LOB_BY_VALUE`가 확인됐다. `CAPPLM`은 Project/Cost 보강에서 6/15, `CDECIM`은 응답 경로에서 6~7/15만 쓴다. 신청/결재 쓰기 경로의 엔티티 조회는 그대로 둔다.
- **관리자 파일·토큰**: 파일은 전체 61/활성 57건, 토큰은 14건이다. 파일 목록은 저장 본문·경로를, 토큰 목록은 API 토큰을 응답하지 않지만 전체 엔티티를 적재한다. 특히 토큰 목록은 원문이 아니라 갱신 조회값 일부만 마스킹하므로 최소 선택이 보안상 노출면도 줄인다.
- **로그인 이력**: 20행 page SQL은 hash `190441828`, FULL + WINDOW SORT, Cost 294였다. 전체 엔티티는 table Rows 1,701/Bytes 1.294M/Temp 1.376M이고, 7필드 SQL은 같은 hash/cardinality에서 Cost 232, Bytes 1.000M/Temp 1.056M이었다. 사용자명은 page의 ENO를 `UserNameView` 한 번으로 배치 조회해야 현재 행별 `resolveUserName` N+1까지 제거된다.
- **요구사항 문서 버전**: `Brdocm`은 JPA 매핑 18컬럼(물리 19)이고 `VersionResponse`는 `docMngNo,docVrsSno,fstEnrDtm,lstChgDtm,delYn` 5개만 쓴다. 로컬 26건/활성 24건/11문서, 문서별 최대 11버전이며 CLOB 최대 길이는 266,794자다. 전체 hash `2391463171`, INDEX RANGE DESC, Bytes 3,815/Cost 0이고 5필드 SQL은 동일 hash/Cost에서 Bytes 75다.

### 3. 필수 집행 4단계 점검

| 단계 | Repository → Service → DTO 경로 | 마스터 판정 | 부속/표시명 판정 | 실제 로컬 건수 |
| ---- | -------------------------------- | ----------- | ---------------- | -------------- |
| 계약 | `ContractRepositoryImpl.findCurrentWithTargetName` → `ContractService.get` → `ContractDto.Detail` | 14/20이지만 LEFT JOIN 2 + DISTINCT/Cost 10으로 **명백** | 대상명 CASE와 JOIN/DISTINCT 유지, 엔티티 대신 15필드 row | `BCONTM` 0 |
| 소요예산 | `EstimateRepository` + `EstimateLineRepository` + `ProjectRepository` → `EstimateService.get` → `EstimateDto.Detail` | 7/13, 요청 300자/Cost 2로 **경계선** | line 4/13은 **명백**; 사업명 단건은 구현 가능, 무정렬 배치는 차단 | `BESTIM` 4, 활성 line 0 |
| 과업심의 | `DeliberationRepositoryImpl.findCurrentWithTargetName` → `DeliberationService.get` → `DeliberationDto.Detail` | 16/22이지만 LEFT JOIN 2 + DISTINCT/Cost 10으로 **명백** | 1,000자 필드는 `OPNN_CONE` 1개, 17필드 row | `BDELIM` 0 |
| 대금지급 | `PaymentRepositoryImpl.findCurrentWithTargetName` + `PaymentLineRepository` → `PaymentService.get` → `PaymentDto.Detail` | 10/16이지만 LEFT JOIN 2 + DISTINCT/Cost 10으로 **명백** | 마스터 요청 300자, 1,000자 의견은 line; 둘 다 projection | `BPAYMM`/`BPAYTM` 0 |

단건 상세라는 이유만으로 제외하지 않고 전부 계획을 확인했다. Estimate 마스터만 사용률·단순 PK 접근 때문에 경계선이다. Contract/Deliberation/Payment 마스터는 사용률이 높아도 두 LEFT JOIN과 `DISTINCT(HASH UNIQUE)`, Cost 10이라는 명백 규칙을 충족하므로 이번 구현 대상이다.

### 4. 경계선과 제외 근거

- Estimate 마스터, Application 마스터, 공통코드, 가이드, 게시판 메타/댓글, 조직 전체 목록은 응답이 컬럼 대부분 또는 대형 본문을 실제 사용한다. 이들은 `TASK.md` 후속 측정 항목으로 등록하되 운영 실행 통계가 없으면 우선 구현하지 않는다.
- Project/Cost에는 `searchListByCondition` 경량 QueryDSL DTO와 Oracle 통합 테스트가 이미 존재한다. 현재 서비스의 `searchByCondition`은 wide `Response` 계약을 반환해 그대로 치환할 수 없다. 신규 projection 구현이 아니라 목록 API 계약을 분리한 뒤 기존 경량 메서드를 연결하는 후속 과제다.
- 알림함은 `Page<Cinfmm>` 엔티티를 직접 반환해 21/21이 API 계약이다. 먼저 응답 DTO를 정의하지 않으면 projection 치환이 직렬화 계약을 바꾸므로 경계선으로 남겼다.
- `findByEno`의 인증·로그인, `AuthorOrgResolver`/`OrgNameResolver`와 Project/Cost의 생성·수정 조직 스냅샷, BoardPost/BoardComment 멘션 존재검증, 신청/결재 mutation·동기화, Contract/Estimate/Deliberation/Payment 상태변경, 게시글·댓글 수정, `BudgetWorkService.applyRates` 등 쓰기 규칙 검증·Dirty Checking 경로는 projection 범위에서 명시적으로 제외했다. 같은 Repository 메서드를 읽기와 쓰기가 공유하면 기존 엔티티 메서드를 유지하고 **응답 전용 새 메서드**만 추가한다.
- native scalar/집계/시퀀스, QueryDSL constructor/record, projection interface 반환은 전체 엔티티 적재가 아니므로 제외했다. 개발 전용 `DevAuthController`와 호출되지 않는 `findByTemC`도 이번 운영 최적화에서 제외했다.

## 결론과 승인 게이트

- 명백 후보는 **26개 호출 경로 묶음**, 경계선은 **9개 호출 경로 묶음**이다. 명백 26개 중 `BudgetWorkService`의 무정렬 BPROJM 대표 이름 선택 1개 하위 경로는 **명백-차단**이며, 정책 승인 전 Task 13에서 보류한다.
- 1차 구현 우선순위는 **요구사항 버전/게시글 → 사용자·조직 응답 → 계획·BBUGTM·BITEMM·BCOSTM(차단 BPROJM 제외) → 결재 응답 및 Contract/Deliberation/Payment 상세 → 4단계 line → 로그인 이력 → 관리자 파일·토큰** 순으로 제안한다.
- 각 신규 조회는 기존 WHERE/IN, 정렬, null 처리와 대표 버전 선택 순서를 보존하고, 기존 엔티티 조회와 결과 필드가 같은 Oracle 통합 테스트를 먼저 작성해야 한다.
- **BPROJM 사용자 결정 필요**: (권고) `LST_YN='Y'` 우선 후 `SNO DESC`로 대표를 결정하고 이름이 null이면 다음 행/원본키 폴백할지, 또는 현재 무정렬 첫 행을 그대로 위험 수용할지 승인해야 한다. 결정 전 해당 배치 이름 projection은 구현하지 않는다.
- **Task 13 사용자 승인: 대기**
- **승인된 실행 계약 커밋: 대기**
- 승인된 계획 커밋 해시가 이 절에 기록되기 전에는 Task 13 구현을 시작하지 않는다.
