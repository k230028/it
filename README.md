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

배포파일 빌드

```
cd C:\it\it_backend; ./gradlew bootWar -x test
```

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

배포파일 빌드

```
cd C:\it\it_frontend; npm run generate:dev
```

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

## IDE 설정(VS Code)

`.vscode/settings.json`·`.vscode/launch.json`은 **의도적으로 추적**합니다. 프로젝트 공통 함정의 회피책이 들어 있어 새 개발자가 같은 문제를 다시 겪지 않게 하는 것이 목적입니다. 대신 **머신 종속 값은 이 파일에 두지 않습니다** — 워크스페이스 설정이 사용자 설정을 덮으므로, 절대경로를 박아 두면 저장소를 다른 경로나 다른 PC에 클론한 사람의 Java 확장 임포트가 실패합니다(REPO-01).

### 각자의 사용자 설정에 넣을 값

`Ctrl+Shift+P` → `Preferences: Open User Settings (JSON)`에 아래 두 값을 자기 PC 경로로 넣습니다.

```jsonc
{
    // Lombok javaagent 경로 — 클론 위치에 맞게 고칩니다.
    // 이 설정은 키 단위로 덮이므로 GC·힙 옵션까지 함께 적어야 합니다.
    "java.jdt.ls.vmargs": "-XX:+UseParallelGC -XX:GCTimeRatio=4 -XX:AdaptiveSizePolicyWeight=90 -Dsun.zip.disableMemoryMapping=true -Xmx2G -Xms100m -Xlog:disable -javaagent:C:/it/it_backend/lib/lombok.jar",
    // 직접 풀어 둔 Gradle 설치본 경로 (버전은 gradle/wrapper/gradle-wrapper.properties와 맞춥니다)
    "java.import.gradle.home": "C:/gradle/gradle-9.2.1"
}
```

`java.import.gradle.home`이 필요한 이유는 워크스페이스 설정의 `java.import.gradle.wrapper.enabled: false`와 짝입니다. 어떤 환경에서는 `.gradle\wrapper\dists`의 zip rename이 보안 프로그램에 막혀 Gradle 확장(`vscjava.vscode-gradle`)이 배포판을 매번 삭제·재설치하다 실패합니다. 터미널의 `./gradlew`는 wrapper를 그대로 쓰므로 이 설정과 무관하게 동작합니다.

### standalone Gradle을 직접 실행하지 않습니다

빌드·테스트는 항상 저장소의 Wrapper(`./gradlew`)로 실행합니다. PATH나 IDE에 다른 버전의 Gradle 설치본이 있어도 `it_backend`에서 `gradle ...`을 직접 실행하지 않습니다.

- standalone Gradle로 `wrapper` 태스크가 돌면(직접 입력했든 IDE·도구가 대신 실행했든) `gradle/wrapper/gradle-wrapper.properties`가 **그 설치본 버전으로 덮어써집니다**. `distributionSha256Sum`은 이전 값이 그대로 남아 URL과 짝이 어긋나고, 폐쇄망용 `file:///c:/maven-repo/...` 주석 블록도 함께 지워집니다.
- 덮어쓴 버전이 구버전이면 Java 확장 임포트가 `Can't use Java 25.0.2 and Gradle 8.9 to import Gradle project it_backend`로 실패합니다. Gradle 8.9의 실행 JVM 상한은 Java 22이고 Java 25 실행 지원은 Gradle 9.1부터라, JDK 25 위에서는 동작하지 않습니다. 이 프로젝트 기준은 **Gradle 9.2.1 + JDK 25**입니다.
- 같은 증상이 특정 PC에서만 난다면 그 PC의 사용자 설정 `java.import.gradle.home`·`java.import.gradle.version`이 옛 버전을 가리키는지도 함께 확인합니다.

이미 덮어썼다면 이렇게 되돌립니다.

```powershell
git -C C:\it\it_backend checkout -- gradle/wrapper/gradle-wrapper.properties
Remove-Item -Recurse -Force C:\it\it_backend\.gradle\8.9   # 덮어쓴 버전의 캐시 폴더
```

이후 VS Code에서 `Java: Clean Java Language Server Workspace`로 재임포트합니다. Wrapper 버전을 실제로 올릴 때는 `./gradlew wrapper --gradle-version <버전>`으로 갱신하고, `distributionUrl`·`distributionSha256Sum`·폐쇄망 주석이 모두 맞는지 확인한 뒤 커밋합니다.

### 지우면 기동이 깨지는 설정

`java.import.exclusions`의 두 항목은 취향이 아니라 **장애 회피책**입니다.

| 제외 경로            | 지우면 생기는 일                                                                                                                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**/bin/**`        | `bin` 아래에 `.project`·`build.gradle`이 생기면 JDT가 이를 별도 프로젝트로 임포트해 같은 클래스가 두 출력 루트(`bin/main`, `build/classes/java/main`)로 올라갑니다. Spring 기동이 `BeanDefinitionOverrideException`(already defined)으로 실패합니다. |
| `**/.worktrees/**` | `.worktrees` 하위에 같은 이름의 `it_backend` 체크아웃이 있어 JDT가 프로젝트명 `it-it_backend`를 중복 등록하고 `Duplicate root element`로 임포트가 실패합니다. 워크트리는 각자의 창에서 엽니다.                                                            |

`launch.json`의 `classPaths`에 `$Runtime`과 출력 폴더 제외를 명시한 이유도 같은 계열입니다. 기본값(`$Auto`)은 테스트 출력 폴더까지 런타임 클래스패스에 올려, 테스트의 중첩 `@SpringBootConfiguration`이 컴포넌트 스캔에 걸리고 JPA 리포지토리 빈이 두 번 등록되어 기동이 실패합니다.

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
- 프론트는 Nuxt `ssr:false` 정적 CSR이므로 인증 진입과 세션 복원은 클라이언트 `auth.global.ts`가 담당합니다. 핵심 E2E는 API를 모킹하고 Nuxt 개발 서버도 Playwright가 자동 기동하므로, 실제 백엔드 연동 검증과 구분해 실행합니다.
- 프론트는 `runtimeConfig.public.apiBase`를 접두사로 구성한 API URL과 인증 쿠키를 사용합니다. BioAgent 설치 안내는 `NUXT_PUBLIC_ONEPASS_INSTALL_URL`, OpenAPI 타입 생성은 `OPENAPI_BACKEND_URL`을 별도로 사용합니다.
- 개발 실행은 절대 API URL을 사용하고, 정적 프록시 배포는 빈 API 접두사와 same-origin `/api/`·`/sso/` 경로를 사용합니다.
- 백엔드는 Controller에서 입력을 받고, Service에서 JWT 사용자 기준 부서·소유권·상태 전이를 검증합니다.
- 목록·검색은 필요한 경우 QueryDSL 프로젝션을 사용하고, 물리 DB 변경은 애플리케이션 코드와 분리된 Flyway 스크립트로 관리합니다.
- 결재 상태처럼 원 트랜잭션과 함께 성공해야 하는 처리는 동기 이벤트로 연결하고, 알림·메일처럼 원 업무를 롤백하면 안 되는 부수효과는 커밋 이후 별도 트랜잭션으로 처리합니다.
- 업무·검증 예외는 백엔드 전역 처리기가 일관된 JSON 오류 응답으로 변환하고, 프론트 페이지·다이얼로그가 사용자 동작 맥락에 맞는 toast와 이동 여부를 결정합니다.

새 API나 조회 흐름을 추가할 때는 백엔드 DTO·OpenAPI 계약과 계약 테스트를 먼저 확정합니다. 목록은 DB 프로젝션·안정 정렬·페이지 상한을 사용하고, 여러 ID를 조립하는 응답은 IN 배치 조회를 사용합니다. 프론트는 계약 확정 후 `npm run codegen`과 `npm run codegen:check`를 실행하며, 정상 빈 결과·초기 조회 실패·재조회 실패를 서로 다른 UI 상태로 유지합니다.

## 주요 업무 모듈

| 흐름             | 프론트 진입점                                                              | 백엔드 책임                                                                                             |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 정보화사업·예산 | `app/pages/info/projects`, `app/pages/info/cost`, `app/pages/budget` | 정보화사업·경상사업·전산업무비, SNO 기반 재상신 이력과 결재 연계                                      |
| 사업계획         | `app/pages/project/bizplan`                                              | 계획 대상 확인, 보고서·일정·품목·계약 병합, 작성 상태 관리                                           |
| 사업 집행        | `app/pages/project`                                                      | 소요예산 산정 → 과업심의 → 입찰계약 → 대금지급 상태 전이                                             |
| 문서·사전협의   | `app/pages/info/documents`                                               | 문서 버전, 검토 의견, 첨부파일과 결재 연결                                                              |
| 홈 대시보드      | `app/pages/info/index.vue`                                               | 연도별 사업·예산 KPI, 예산 일정, 공지·일정 피드, 홈 배너                                              |
| 수기 엑셀 이관   | `app/pages/admin/migration`                                              | 편성요청서 분석·반입, 원본 파일 보관과 결재 연계                                                       |
| 전자결재         | `app/pages/approval`                                                     | 결재 대시보드·목록·상세와 승인·반려·회수 명령                                                       |
| 공통 게시판      | `app/pages/board`                                                        | 게시글·댓글·첨부파일·멘션 관리. 본문은 Tiptap HTML로 저장하고 서버 정화 후 표시                      |
| 공통 안내 팝업   | `app/pages/admin/common-popup.vue`, 공통 `AppShell`                    | `TPRMPP_BGDOCM`의 `common.popup` 게시·중지와 콘텐츠 버전별 안내 표시                               |
| 스피드다이얼     | 공통`AppShell`, `app/pages/admin/contact-information.vue`              | 전역 FAQ 조회·Q&A 등록·담당자 정보 열람. FAQ·Q&A는 공통 게시판 유형(`004`·`005`)을 재사용       |
| 사용자가이드     | 헤더 버튼,`app/pages/admin/user-guides.vue`                              | 전사 공개 가이드 파일 업로드·내려받기·이력 되돌리기. 현재 가이드는 항상 0건 또는 1건                  |
| 공통 데이터 이관 | `app/pages/admin/migration/common-data.vue`                              | 메뉴·메뉴권한·경로·공통코드·다국어를 개발→운영으로 내보내기·dry-run·확정 반영                    |
| 사전진단·가이드 | `app/pages/diagnosis`, `app/pages/guide`                               | 클라이언트 설문 결과와 서버 문서·첨부·변수 카탈로그 조회                                              |
| 공통 기능        | 공통 레이아웃·메뉴·알림·관리자 화면                                     | 인증, MFA, IAM, 서버 권한 메뉴, 게시판, 알림, 다국어, 배너, 입력 길라잡이, 감사·실시간 로그와 WAS 로그 |

메뉴는 백엔드가 사용자 권한으로 필터링한 `/api/menus` 트리를 프론트 헤더·사이드바·Breadcrumb·상단 탭이 함께 사용합니다. 탭 제목도 화면에 하드코딩하지 않고 이 트리의 메뉴명을 따릅니다. 프론트 메뉴 숨김은 화면 편의를 위한 것이며 API 접근 권한을 대신하지 않습니다.

## 주요 설계 원칙

- JWT는 백엔드가 httpOnly 쿠키로 발급하고 프론트가 직접 저장하거나 읽지 않습니다.
- 프론트 라우트 가드는 UX 보호이며 백엔드 권한 검증이 최종 보안 경계입니다.
- 백엔드 접속 계정과 객체 소유 스키마를 분리하고 세션 `CURRENT_SCHEMA=ITPOWN`을 사용합니다.
- 업무 엔티티는 Soft Delete와 감사 로그 패턴을 사용합니다.
- Oracle 문자셋은 `AL32UTF8`이고 `VARCHAR2`는 BYTE semantics를 사용합니다. 저장 한도는 UTF-8 실제 바이트 길이로 판정하며, 신규·변경 입력은 프론트와 백엔드의 공통 바이트 유틸로 검증하고 신규 DDL은 `VARCHAR2(n BYTE)`를 명시합니다.
- 결재완료된 정보화사업·경상사업·전산업무비의 재상신은 같은 관리번호에서 다음 SNO의 비최종 초안을 만들고, 승인 완료 시 해당 순번을 최종본으로 전환합니다. 후속 업무 목록·집계는 `LST_YN='Y'`만 사용하되 미상신 작성 목록에는 재상신 초안도 표시합니다.
- 공통코드·메뉴 권한·알림 미읽음 수·Tiptap 메타데이터는 Caffeine 캐시를 사용하며, 원본 변경 시 서비스가 캐시를 무효화합니다.
- 데이터베이스 변경은 `it_database/migrations`의 새 Flyway 스크립트로 관리합니다.
- 운영 정적 생성은 백엔드와 공유하는 `SPRING_PROFILES_ACTIVE`를 사용하며, 미설정·미지원 프로파일은 fail-fast로 중단합니다.
- 신규 주석은 한글로 작성하고 코드만 읽어도 명확한 설명은 생략합니다.

세부 규칙은 각 저장소의 `CLAUDE.md`와 가이드를 확인합니다.

## 문서 역할

| 문서                       | 역할                            |
| -------------------------- | ------------------------------- |
| `README.md`              | 설치, 실행, 저장소 탐색         |
| `CLAUDE.md`              | 반드시 지킬 공통 규칙           |
| `it_frontend/CLAUDE.md`  | 프론트 필수 규칙                |
| `it_backend/CLAUDE.md`   | 백엔드 필수 규칙과 보안 경계    |
| `it_database/CLAUDE.md`  | DB 변경·마이그레이션 안전 규칙 |
| `docs/guides`            | 주제별 상세 설명과 예제         |
| `docs/operations`        | 배포·복구·인계 기록           |
| `TASK.md`                | 미구현, 기술부채, 후속 검증     |
| `it_database/migrations` | 물리 DB 변경 이력               |

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

### 데이터베이스

- [데이터베이스 빠른 시작](it_database/README.MD)
- [데이터베이스 필수 규칙](it_database/CLAUDE.md)
- [데이터베이스 가이드 인덱스](it_database/docs/guides/README.md)
- [마이그레이션 작성과 검증](it_database/docs/guides/migrations.md)

## AI 작업 흐름

에이전트의 필수 작업 순서, 스킬 우선순위와 검증 진입점은 [CLAUDE.md](CLAUDE.md) §4~5를 따릅니다. 사람은 위 「품질 확인」 명령과 각 저장소 README의 개발·배포 절차로 동일한 검증을 수행할 수 있습니다.

## 변경 이력

새 개발자가 최근 흐름을 파악할 수 있도록 주요 변경을 최신순으로 기록합니다. 시점성 정보(파일 수·테스트 건수 등)는 여기 또는 `TASK.md`에만 남기고 `CLAUDE.md`에는 남기지 않습니다.

- 2026-09-03: 공통 안내 팝업 — 관리자가 `TPRMPP_BGDOCM`의 `common.popup` 문서를 게시·중지하고, 인증 화면의 공통 AppShell이 콘텐츠 버전별 안내 다이얼로그를 표시. “다시 보지 않기”는 1년 쿠키로 관리하며 내용 변경 시 다시 표시
- 2026-09-02: 게시글 본문 리치에디터 전환과 멘션 — 게시글 본문을 textarea에서 Tiptap으로 바꾸고, 저장된 멘션 식별자를 보존해 상세에서 직원 정보 버튼으로 표시
- 2026-09-01: 결재선 편집 — 결재중 신청서의 미결 결재선을 다이얼로그에서 원자적으로 교체. 완료된 결재자의 순서는 보존하고, 상태 변경 명령은 신청서 행을 잠근 뒤 수행
- 2026-09-01: DB 문자열 기준 확정 — ITPOWN의 `VARCHAR2`를 `AL32UTF8` BYTE semantics로 통일하고, 공통 유틸과 주요 사업·이관 입력을 UTF-8 실제 바이트 길이 기준으로 정렬
- 2026-09-01: 예산 재상신 — 정보화사업·경상사업은 `BPROJM.SNO`, 전산업무비는 `BCOSTM.BG_SNO`로 결재완료본의 다음 순번 초안을 만들고 승인 시 최종본을 전환하도록 변경
- 2026-08-31: 사용자가이드 — 전용 테이블 없이 공통첨부파일(`TPRMPP_CFILEM`)을 재사용해 전사 공개 가이드를 관리. 업로드·되돌리기가 같은 트랜잭션에서 기존 활성 건을 내려 현재 가이드를 항상 0건 또는 1건으로 유지
- 2026-08-30: 스피드다이얼 — 관리자 화면을 제외한 전 화면에 FAQ·Q&A·담당자 정보 전역 버튼 신설. FAQ·Q&A는 공통 게시판 유형을 재사용하고, Q&A 등록 시 현재 화면 이름·경로를 함께 남김
- 2026-08-29: 공통 데이터 이관 — 메뉴·메뉴권한·경로·공통코드·다국어 5개 테이블을 xlsx로 내보내 운영에 dry-run 후 확정 반영. 메뉴 반입 뒤 시퀀스를 파일 최대 번호 이상으로 전진
- 2026-08-29: 금융정보단말기 일괄 반입 — 단말기 업로드 행을 연도별 전산업무비 원장으로 검증·반영
- 2026-08-28: 정적 분석 취약점 조치 — Refresh Token·MFA 거래의 저장 지문을 무키 SHA-256에서 서버 비밀키와 용도 구분자를 쓰는 HMAC-SHA256으로 전환하고, 프론트 식별자 난수의 `Math.random()` 폴백을 제거해 미지원 환경에서는 명시적으로 실패하도록 변경
- 2026-08-28: 결재선 관리 — 결재중 신청서에 미결재 결재자를 추가·삭제하고 순서를 조정. 결재자 구분 플래그는 도입 당일 철회해 모든 결재자를 동일하게 취급
- 2026-08-27: 예산작성 화면 카드 메모 — 정보화사업·전산업무비·경상사업 카드의 안내 메모를 문서(BGDOCM)로 보관하고 관리자만 편집
- 2026-08-25: 사업 입력 길라잡이 — 서버 고정 카탈로그가 정한 입력 필드에 관리자가 안내 본문을 등록하고(`/admin/form-guides`), 사업·전산업무비 입력 폼이 활성 필드의 안내를 옆 패널로 표시. 본문은 저장 시 서버 정화, 표시 시 클라이언트 정화를 모두 거침
- 2026-08-24: 정보화사업 금액 의미 정리 — 당해금액과 총소요금액을 구분하고 품목 예정금액을 독립 금액으로 저장. 외화 예정금액의 원화 환산과 저장 단위 반올림·범위 검증을 한 곳으로 모으고, 계속사업 금액의 자동 이월을 제거
- 2026-08-24: 공통첨부파일 부모 키 컬럼 개명·폭 축소 — 실제 쓰임이 "첨부파일 종류와 연결 콘텐츠"였던 두 컬럼을 이름과 폭에 맞게 정정(BE-51 후속)
- 2026-08-22: 준비중 메뉴 — 관리자가 메뉴를 준비중으로 표시하면 서버가 `/preparing/{mnuId}` 경로를 채번해 라우트 카탈로그에 함께 등록하고, 준비중 해제·삭제 시 자동 생성한 경로만 회수
- 2026-08-22: 게시판 첨부 일괄 내려받기(ZIP)와 일정 게시판 도입 — 일정 게시판은 시작·종료일자를 공개기간이 아니라 일정으로 다뤄 공개기간 필터에서 제외
- 2026-08-20: 편성요청서 반입 원본 파일 트리와 진행률 표시 — 부서 폴더째 드롭 업로드, 분석·반입 배치 진행률 다이얼로그, 부서별 원본 파일·진단 다이얼로그, 원본 ZIP 내려받기
- 2026-08-20: SEC-16 MFA 다중 인스턴스 지원 — MFA·로그인대기 거래를 Oracle 공유 테이블(`TPRMPP_CMFATM`/`TPRMPP_CMFADM`)로 옮기고 서비스·공급자의 인스턴스 로컬 상태를 제거, 만료 행 정리 배치 추가
- 2026-08-20: 실시간 WAS 로그 뷰어(`/admin/was-logs`) — logback 링버퍼 적재, 관리자 전용 조회·다운로드, TTL이 붙은 런타임 로그레벨 변경, 다중 인스턴스 피어 팜아웃과 관리자 행위 감사
- 2026-08-19: `/info` 홈 개편 — 올해·내년 KPI 카드(건수형·금액형)와 예산 일정 카드, 부서·전체 조회 범위 전환, 홈 배너 캐러셀과 배너 관리 화면(`/admin/banners`) 신설
- 2026-08-19: 편성요청서 반입 판정 개선 — 대상 아닌 파일 SKIPPED 분리, 일반관리비 통화 공통코드 확정(미해석 행 차단·후보 제시), 전결권자 미매칭 진단에 공통코드 후보 제공
- 2026-08-18: 편성요청서 반입 원본 파일 보관·열람 — 반입 원본을 공통첨부파일로 보관(부서 교차 연결 차단)하고 결재현황 뷰어에서 원본 목록 표시, 파일 읽기/쓰기 authorizer 등록
- 2026-08-18: FE-37 사이트 전체 고정 문구 i18n 이관 완료(고정 문구 감사 기준선 0건 달성)
- 2026-08-18: 다국어 번역 변경로그(TPRMPP_CLANGL) 추가와 관리자 다국어 관리 화면(/admin/translations) 신설
