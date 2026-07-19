# IT Project Portal

정보화 예산, 사업, 인력, 문서 검토, 결재와 관리자 로그를 제공하는 사내 포털입니다.

## 저장소 구성

```text
C:\it\
├── it_frontend/   Nuxt 4 CSR 프론트엔드
├── it_backend/    Spring Boot API
├── it_database/   DDL·시드·Flyway 마이그레이션
├── docs/          공통 설계·계획·검증 문서와 Superpowers 산출물
├── CLAUDE.md      공통 필수 규칙
└── TASK.md        미구현·기술부채
```

각 하위 저장소는 독립 Git 저장소입니다. 코드 변경과 테스트는 해당 저장소에서 수행합니다.

## 빠른 시작

### 1. Oracle 확인

- 접속 계정: `ITPAPP`
- 객체 스키마: `ITPOWN`
- 주소: `127.0.0.1:11521/XEPDB1`

```powershell
sqlplus ITPAPP/<비밀번호>@127.0.0.1:11521/XEPDB1
```

### 2. 백엔드

```powershell
cd C:\it\it_backend
$env:SPRING_PROFILES_ACTIVE = "local-ext"
./gradlew bootRun
```

- API: http://localhost:28080
- Swagger: http://localhost:28080/swagger-ui/index.html
- Health: http://localhost:28080/actuator/health

외부망 로컬 개발은 모의 SSO와 Flyway 자동 적용을 사용하는 `local-ext`, 내부 ESSO 연동 환경은 `local-int` 프로파일을 사용합니다. `dev`와 `prod`에서는 Flyway를 자동 실행하지 않습니다.

### 3. 프론트엔드

```powershell
cd C:\it\it_frontend
npm install
npm run dev
```

- 화면: http://localhost:3000
- 기본 API 주소: http://localhost:28080

## 품질 확인

프론트엔드:

```powershell
cd C:\it\it_frontend
npm run format:check
npm run check
npm test
npm run test:e2e
```

백엔드:

```powershell
cd C:\it\it_backend
./gradlew test
./gradlew integrationTest
./gradlew jacocoTestCoverageVerification
```

백엔드 기본 테스트는 로컬 Oracle 의존 통합 테스트를 제외하며, 실제 Oracle 매핑과 QueryDSL은 `integrationTest`로 분리합니다. 브라우저 핵심 흐름은 두 서버를 실행한 뒤 Playwright 또는 `/qa` 워크플로우로 확인합니다.

## 전체 요청 흐름

```text
Nuxt 페이지·컴포넌트
  → composable / Pinia store
  → useApiFetch(GET) 또는 $apiFetch(명령형 요청)
  → Spring Security·JWT 쿠키 필터
  → Spring Controller(DTO·Bean Validation)
  → Service(권한·트랜잭션·업무 규칙)
  → Repository(JPA·QueryDSL)
  → Oracle ITPOWN 스키마
```

- 프론트는 `runtimeConfig.public.apiBase` 기반 절대 URL과 인증 쿠키를 사용합니다.
- 백엔드는 Controller에서 입력을 받고, Service에서 JWT 사용자 기준 부서·소유권·상태 전이를 검증합니다.
- 목록·검색은 필요한 경우 QueryDSL 프로젝션을 사용하고, 물리 DB 변경은 애플리케이션 코드와 분리된 Flyway 스크립트로 관리합니다.
- 결재 상태처럼 원 트랜잭션과 함께 성공해야 하는 처리는 동기 이벤트로 연결하고, 알림·메일처럼 원 업무를 롤백하면 안 되는 부수효과는 커밋 이후 별도 트랜잭션으로 처리합니다.
- 업무·검증 예외는 백엔드 전역 처리기가 일관된 JSON 오류 응답으로 변환하고, 프론트 페이지·다이얼로그가 사용자 동작 맥락에 맞는 toast와 이동 여부를 결정합니다.

## 주요 업무 모듈

| 흐름            | 프론트 진입점                                 | 백엔드 책임                                                |
| --------------- | --------------------------------------------- | ---------------------------------------------------------- |
| 정보화사업·예산 | `app/pages/info/projects`, `app/pages/budget` | 사업, 예산편성, 전산업무비와 결재 연계                     |
| 사업계획        | `app/pages/project/bizplan`                   | 계획 대상 확인, 보고서·일정·품목·계약 병합, 작성 상태 관리 |
| 사업 집행       | `app/pages/project`                           | 소요예산 산정 → 과업심의 → 입찰계약 → 대금지급 상태 전이   |
| 문서·사전협의   | `app/pages/info/documents`                    | 문서 버전, 검토 의견, 첨부파일과 결재 연결                 |
| 공통 기능       | 공통 레이아웃·메뉴·알림·관리자 화면           | 인증, IAM, 서버 권한 메뉴, 게시판, 알림, 감사·실시간 로그  |

메뉴는 백엔드가 사용자 권한으로 필터링한 `/api/menus` 트리를 프론트 헤더·사이드바·Breadcrumb가 함께 사용합니다. 프론트 메뉴 숨김은 화면 편의를 위한 것이며 API 접근 권한을 대신하지 않습니다.

## 주요 설계 원칙

- JWT는 백엔드가 httpOnly 쿠키로 발급하고 프론트가 직접 저장하거나 읽지 않습니다.
- 프론트 라우트 가드는 UX 보호이며 백엔드 권한 검증이 최종 보안 경계입니다.
- 백엔드 접속 계정과 객체 소유 스키마를 분리하고 세션 `CURRENT_SCHEMA=ITPOWN`을 사용합니다.
- 업무 엔티티는 Soft Delete와 감사 로그 패턴을 사용합니다.
- 공통코드·메뉴 권한·알림 미읽음 수·Tiptap 메타데이터는 Caffeine 캐시를 사용하며, 원본 변경 시 서비스가 캐시를 무효화합니다.
- 데이터베이스 변경은 `it_database/migrations`의 새 Flyway 스크립트로 관리합니다.
- 신규 주석은 한글로 작성하고 코드만 읽어도 명확한 설명은 생략합니다.

세부 규칙은 각 저장소의 `CLAUDE.md`와 가이드를 확인합니다.

## 문서 역할

| 문서                     | 역할                         |
| ------------------------ | ---------------------------- |
| `README.md`              | 설치, 실행, 저장소 탐색      |
| `CLAUDE.md`              | 반드시 지킬 공통 규칙        |
| `it_frontend/CLAUDE.md`  | 프론트 필수 규칙             |
| `it_backend/CLAUDE.md`   | 백엔드 필수 규칙과 보안 경계 |
| `docs/guides`            | 주제별 상세 설명과 예제      |
| `TASK.md`                | 미구현, 기술부채, 후속 검증  |
| `it_database/migrations` | 물리 DB 변경 이력            |

## 상세 문서

### 프론트엔드

- [프론트 빠른 시작](it_frontend/README.md)
- [프론트 필수 규칙](it_frontend/CLAUDE.md)
- [프론트 가이드 인덱스](it_frontend/docs/guides/README.md)
- [API 클라이언트](it_frontend/docs/guides/architecture/api-client.md)
- [공통 컴포넌트](it_frontend/docs/guides/components/common-components.md)
- [디자인 토큰](it_frontend/docs/guides/styling/design-tokens.md)

### 백엔드

- [백엔드 빠른 시작](it_backend/README.md)
- [백엔드 필수 규칙](it_backend/CLAUDE.md)
- [백엔드 가이드 인덱스](it_backend/docs/guides/README.md)
- [데이터 모델 인덱스](it_backend/docs/guides/persistence/data-model.md)
- [인증과 인가](it_backend/docs/guides/security/authentication-authorization.md)
- [Flyway 운영](it_backend/docs/guides/operations/flyway.md)

## AI 작업 흐름

- 새 기능은 계획·구현·검증 순서로 진행합니다.
- 버그는 재현과 원인 확인 후 수정합니다.
- 화면 QA는 두 서버를 실행한 뒤 `/qa`를 사용합니다.
- 코드 리뷰는 diff 기준 `/review`, 품질 점검은 `/health`, 배포 준비는 `/ship`을 사용합니다.

사용 가능한 도구의 세부 동작보다 코드와 문서의 SoT를 우선합니다.
