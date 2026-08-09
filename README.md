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
sqlplus ITPAPP@127.0.0.1:11521/XEPDB1
```

비밀번호는 sqlplus 콘솔 프롬프트에만 입력합니다. CI·무인 실행은 명령줄 또는 환경변수 비밀번호 대신 Oracle Secure External Password Store의 Wallet 별칭(`/@별칭`)을 사용합니다.

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
npm ci
npm run dev
```

- 화면: http://localhost:3000
- 기본 API 주소: http://localhost:28080

최초 체크아웃과 CI는 `package-lock.json`을 그대로 재현하는 `npm ci`를 사용합니다. 패키지를 추가하거나 버전을 바꿀 때만 `npm install`로 lockfile을 함께 갱신합니다.

### 4. 정적 배포 빌드

프론트 정적 생성은 백엔드와 같은 `SPRING_PROFILES_ACTIVE` 값을 읽어 환경별 스크립트를 선택합니다. 콤마로 여러 프로파일을 지정하면 첫 번째 값만 판정하며, `local*`은 `.env.local`, `dev`는 `.env.development`, `prod`는 `.env.production`을 사용합니다.

```powershell
cd C:\it\it_frontend
$env:SPRING_PROFILES_ACTIVE = "prod"
npm run generate
```

모든 정적 생성 스크립트는 API 기준 주소를 빈 값으로 강제해 브라우저가 same-origin `/api/`와 `/sso/`를 호출하게 합니다. 따라서 nginx·WebTobe는 두 경로를 백엔드로 프록시해야 합니다. API 호출에는 CORS가 발생하지 않지만 SSO 완료 후 복귀 주소는 백엔드 Origin 허용 목록으로 검증하므로, 실제 프론트 Origin을 `APP_FRONTEND_URL` 또는 `CORS_ALLOWED_ORIGINS`에 `scheme://host[:port]` 형식으로 등록합니다.

nginx.conf
```bash
server {
        listen       80;
        server_name  localhost;
        root C:/it/it_frontend/.output/public; # 빌드된 public 폴더 경로

        location / {
            index  index.html index.htm;
        try_files $uri $uri/ /index.html;  # SPA
        }

        location /sso/ {
        proxy_pass http://localhost:28080;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # 캐시 설정
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
                expires 1y;
                add_header Cache-Control "public, no-transform";
        }

        location /api/ {
                proxy_pass http://localhost:28080;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
        }

        # redirect server error pages to the static page /50x.html
        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   html;
        }
      }
```

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
./gradlew spotlessCheck
./gradlew test
./gradlew integrationTest
./gradlew jacocoTestCoverageVerification
./gradlew check
```

백엔드 기본 테스트는 로컬 Oracle 의존 통합 테스트를 제외하며, 실제 Oracle 매핑과 QueryDSL은 `integrationTest`로 분리합니다. 브라우저 핵심 흐름은 두 서버를 실행한 뒤 `npm run test:e2e` 또는 Playwright MCP로 확인합니다.

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

- 프론트가 사용하는 응답 타입은 백엔드 OpenAPI 스펙(`/v3/api-docs`)에서 생성합니다(`npm run codegen` → `it_frontend/app/types/api.d.ts`). 백엔드 응답 DTO의 `@Schema` 계약이 프론트 타입의 단일 출처이며, 스펙 변경 후 재생성 누락은 `npm run codegen:check`가 잡습니다.
- 프론트는 `runtimeConfig.public.apiBase`를 접두사로 구성한 API URL과 인증 쿠키를 사용합니다.
- 개발 실행은 절대 API URL을 사용하고, 정적 프록시 배포는 빈 API 접두사와 same-origin `/api/`·`/sso/` 경로를 사용합니다.
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

메뉴는 백엔드가 사용자 권한으로 필터링한 `/api/menus` 트리를 프론트 헤더·사이드바·Breadcrumb·상단 탭이 함께 사용합니다. 탭 제목도 화면에 하드코딩하지 않고 이 트리의 메뉴명을 따릅니다. 프론트 메뉴 숨김은 화면 편의를 위한 것이며 API 접근 권한을 대신하지 않습니다.

## 주요 설계 원칙

- JWT는 백엔드가 httpOnly 쿠키로 발급하고 프론트가 직접 저장하거나 읽지 않습니다.
- 프론트 라우트 가드는 UX 보호이며 백엔드 권한 검증이 최종 보안 경계입니다.
- 백엔드 접속 계정과 객체 소유 스키마를 분리하고 세션 `CURRENT_SCHEMA=ITPOWN`을 사용합니다.
- 업무 엔티티는 Soft Delete와 감사 로그 패턴을 사용합니다.
- 공통코드·메뉴 권한·알림 미읽음 수·Tiptap 메타데이터는 Caffeine 캐시를 사용하며, 원본 변경 시 서비스가 캐시를 무효화합니다.
- 데이터베이스 변경은 `it_database/migrations`의 새 Flyway 스크립트로 관리합니다.
- 운영 정적 생성은 백엔드와 공유하는 `SPRING_PROFILES_ACTIVE`를 사용하며, 미설정·미지원 프로파일은 fail-fast로 중단합니다.
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

워크플로우 플러그인은 **Superpowers** 하나만 사용합니다. 상세는 [CLAUDE.md](CLAUDE.md) §5를 따릅니다.

- 새 기능은 `/superpowers:brainstorming` → `/superpowers:writing-plans` → `/superpowers:executing-plans` 순서로 진행합니다.
- 버그는 `/superpowers:systematic-debugging`으로 재현과 원인을 확인한 뒤 수정합니다.
- 완료 선언 전에는 `/superpowers:verification-before-completion`으로 실제 명령 출력을 확인합니다.
- 화면 QA는 두 서버를 실행한 뒤 `npm run test:e2e`와 Playwright MCP로 수행합니다.
- 코드 리뷰는 diff 기준 `/code-review`, 보안 검토는 `/security-review`를 사용합니다.
- 품질 점검은 위 「품질 확인」 절의 명령을 직접 실행합니다.

프레임워크 패턴은 `.claude/skills/`에 선별해 둔 참조 스킬로 확인합니다.

| 영역          | 스킬                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `it_backend`  | `/springboot-patterns`, `/java-coding-standards`, `/jpa-patterns`, `/springboot-security`, `/springboot-tdd`, `/springboot-verification` |
| `it_frontend` | `/nuxt4-patterns`, `/vue-patterns`                                                                       |

이 스킬들은 일반 프레임워크 관례를 담은 참고 자료입니다. 본 프로젝트는 CSR 전용 프론트, `useApiFetch`/`$apiFetch` 래퍼, httpOnly 쿠키 인증, Flyway 전용 스키마 변경을 사용하므로 스킬의 SSR·토큰 저장·`ddl-auto` 전제와 어긋나는 부분이 있습니다. 충돌 시 항상 코드와 저장소 문서의 SoT를 우선합니다. 예외 목록은 [CLAUDE.md](CLAUDE.md) §5.4에 정리했습니다.
