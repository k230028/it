# Codebase Structure

**Analysis Date:** 2026-05-19

## Directory Layout

```
it/                                        # 모노레포 루트 (C:\it)
├── CLAUDE.md                              # 프로젝트 메인 가이드 (SoT 분배)
├── AGENTS.md                              # AI 에이전트 운영 규칙
├── META.md                                # 메타 용어사전 (컬럼명·엔티티명 표준)
├── DOMAIN.md                              # 메타 도메인사전 (컬럼/엔티티 타입)
├── TASK.md                                # 미구현/기술부채/장기 과제 목록
├── README.md                              # 신규 개발자 온보딩 노트
├── REVIEW.md                              # 코드 리뷰 누적 기록
├── TEST.md                                # 테스트 시나리오 메모
├── .planning/                             # GSD 워크플로우 산출물
│   └── codebase/                          # 자동 생성되는 코드베이스 분석 문서
├── prds/                                  # PRD 폴더 (ing/, done/)
├── docs/                                  # PDCA 문서 루트
├── sample/                                # 샘플 자산
├── TaskNotes/                             # 작업 노트
├── pass/  fail/                           # QA 결과 아카이브
├── it_frontend/                           # Nuxt 4 프론트엔드 ────────────────
│   ├── CLAUDE.md                          #   프론트엔드 SoT (기술 스택·인증 책임)
│   ├── README.md  TASK.md                 #   온보딩/백로그
│   ├── nuxt.config.ts                     #   Nuxt 4 설정 (SPA, PrimeVue, Pinia)
│   ├── package.json  package-lock.json    #   npm 의존성
│   ├── tsconfig.json  tailwind.config.js  #   TypeScript / Tailwind 설정
│   ├── eslint.config.mjs                  #   ESLint flat config
│   ├── vitest.config.ts                   #   Vitest 단위테스트 설정
│   ├── playwright.config.ts               #   Playwright E2E 설정
│   ├── .env                               #   NUXT_PUBLIC_API_BASE 등 환경변수
│   ├── app/                               #   ★ Nuxt 4 소스 루트 (~ 별칭)
│   │   ├── app.vue                        #     루트 컴포넌트 (NuxtLayout+NuxtPage)
│   │   ├── error.vue                      #     전역 에러 페이지
│   │   ├── assets/                        #     이미지, 전역 CSS(main.css)
│   │   ├── components/                    #     도메인별·공통 UI 컴포넌트
│   │   │   ├── common/                    #       StyledDataTable, EmployeeSearchDialog 등
│   │   │   ├── budget/  cost/  plan/      #       예산·전산업무비·계획 도메인
│   │   │   ├── projects/  approval/       #       프로젝트·결재 도메인
│   │   │   ├── board/  council/  review/  #       게시판·협의회·검토 도메인
│   │   │   ├── extensions/  icons/        #       Tiptap 확장·아이콘
│   │   │   └── *.vue (AppHeader, AppSidebar, TiptapEditor 등 루트 컴포넌트)
│   │   ├── composables/                   #     useXxx 도메인 로직 (~40개)
│   │   ├── stores/                        #     Pinia 스토어 (auth.ts, review.ts)
│   │   ├── pages/                         #     파일 기반 라우팅
│   │   │   ├── index.vue (→ /info 리다이렉트)
│   │   │   ├── login.vue
│   │   │   ├── admin/                     #       시스템 관리 (ROLE_ADMIN 전용)
│   │   │   ├── approval/                  #       전자결재
│   │   │   ├── audit/                     #       IT 감사
│   │   │   ├── board/                     #       공통 게시판
│   │   │   ├── budget/                    #       전산예산 + 예산 작업
│   │   │   ├── diagnosis/                 #       사전진단
│   │   │   ├── guide/                     #       가이드 문서
│   │   │   └── info/                      #       정보화 대시보드
│   │   │       ├── projects/              #         정보화사업
│   │   │       ├── cost/                  #         전산업무비
│   │   │       ├── documents/             #         요구사항 정의서 + 사전협의
│   │   │       ├── plan/                  #         정보기술부문 계획
│   │   │       ├── council-request/       #         협의회 요청
│   │   │       └── index.vue
│   │   ├── layouts/                       #     default.vue / admin.vue / login.vue
│   │   ├── middleware/                    #     auth.global.ts, admin.ts, budget-period.ts, plan.ts
│   │   ├── plugins/                       #     auth.ts ($apiFetch 제공), theme.server.ts, router-error.client.ts, excalidraw-css.client.ts
│   │   ├── types/                         #     auth.ts(ROLE), board.ts, budgetStatus.ts, budget-work.ts, council.ts, review.ts, tiptapVariable.ts
│   │   └── utils/                         #     common.ts, excel.ts, hwpx.ts, hwpx-images.ts, hwpx-package-xml.ts, adminLogs.ts
│   ├── public/                            #   정적 파일
│   ├── server/                            #   Nuxt server 디렉토리 (현재 비활성)
│   ├── preview/                           #   프리뷰 자산
│   ├── tests/                             #   ★ 테스트
│   │   ├── setup.ts                       #     Vitest 글로벌 셋업
│   │   ├── unit/                          #     Vitest 단위 테스트
│   │   │   ├── components/ composables/   #
│   │   │   ├── middleware/  plugins/      #
│   │   │   ├── stores/  utils/            #
│   │   └── e2e/                           #     Playwright E2E
│   │       ├── *.spec.ts                  #       시나리오별
│   │       ├── auth.setup.ts              #       인증 픽스처
│   │       └── generate-report.ts         #       리포트 생성
│   ├── coverage/  test-results/           #   테스트 산출물 (gitignored)
│   ├── playwright-report/                 #   Playwright HTML 리포트
│   ├── .output/  .nuxt/                   #   빌드 산출물
│   └── docs/                              #   프론트엔드 가이드 (styled-data-table.md 등)
├── it_backend/                            # Spring Boot 백엔드 ────────────────
│   ├── CLAUDE.md                          #   백엔드 SoT (기술 스택·인증·아키텍처)
│   ├── README.md  TASK.md                 #   온보딩/백로그
│   ├── build.gradle  settings.gradle      #   Gradle Groovy DSL
│   ├── gradlew  gradlew.bat  gradle/      #   Gradle Wrapper
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/kdb/it/           #   ★ 패키지 루트
│   │   │   │   ├── ItApplication.java     #     Spring Boot 진입점
│   │   │   │   ├── config/                #     Spring/JPA/Security/Swagger 설정
│   │   │   │   │   ├── SecurityConfig.java
│   │   │   │   │   ├── JpaAuditConfig.java
│   │   │   │   │   ├── QuerydslConfig.java
│   │   │   │   │   ├── SwaggerConfig.java
│   │   │   │   │   ├── JacksonConfig.java
│   │   │   │   │   └── SsoWebConfig.java
│   │   │   │   ├── common/                #     공통 도메인
│   │   │   │   │   ├── admin/             #       시스템관리 (ROLE_ADMIN)
│   │   │   │   │   │   ├── controller/  dto/  service/
│   │   │   │   │   ├── approval/          #       결재 (controller/dto/entity/event/repository/service)
│   │   │   │   │   ├── board/             #       공통 게시판
│   │   │   │   │   │   ├── controller/    #         AdminBoardMetaController, BoardMetaController, BoardPostController, BoardCommentController
│   │   │   │   │   │   ├── entity/        #         Cblbmm, Cblbcm, Ccmmtm
│   │   │   │   │   │   ├── dto/  repository/  service/
│   │   │   │   │   ├── code/              #       공통코드 (Ccodem)
│   │   │   │   │   ├── iam/               #       사용자/조직/권한
│   │   │   │   │   │   ├── entity/        #         CauthI, CorgnI, CroleI, CuserI
│   │   │   │   │   │   ├── repository/    #         UserRepository(+Custom/Impl), OrganizationRepository, RoleRepository, AuthRepository
│   │   │   │   │   │   ├── service/       #         UserService, OrganizationService, LoginAttemptService
│   │   │   │   │   │   ├── controller/  dto/
│   │   │   │   │   ├── system/            #       인증·보안 시스템
│   │   │   │   │   │   ├── EnvironmentValidator.java
│   │   │   │   │   │   ├── controller/    #         AuthController, SsoController, LoginHistoryController, DevAuthController
│   │   │   │   │   │   ├── entity/        #         Clognh(로그인이력), Crtokm(리프레시토큰)
│   │   │   │   │   │   ├── repository/    #         LoginHistoryRepository, RefreshTokenRepository
│   │   │   │   │   │   ├── service/       #         AuthService, CustomUserDetailsService, LoginHistoryService
│   │   │   │   │   │   ├── security/      #         JwtUtil, JwtAuthenticationFilter, CustomUserDetails
│   │   │   │   │   │   ├── tiptap/        #         Tiptap 서버 처리(controller/dto/service/util)
│   │   │   │   │   │   └── dto/
│   │   │   │   │   └── util/              #       CookieUtil, CustomPasswordEncoder, HtmlSanitizer
│   │   │   │   ├── domain/                #     비즈니스 도메인
│   │   │   │   │   ├── entity/            #       BaseEntity (모든 업무 엔티티의 상위)
│   │   │   │   │   ├── budget/            #       예산 관리
│   │   │   │   │   │   ├── project/       #         정보화사업 (controller/dto/entity/repository/service)
│   │   │   │   │   │   │   └── entity/    #           Bprojm, BprojmId, Bitemm, BitemmId
│   │   │   │   │   │   ├── cost/          #         전산업무비
│   │   │   │   │   │   │   └── entity/    #           Bcostm, BcostmId, Btermm, BtermmId
│   │   │   │   │   │   ├── document/      #         요구사항 정의서·사전협의
│   │   │   │   │   │   ├── plan/          #         정보기술부문 계획
│   │   │   │   │   │   ├── status/        #         예산현황 (entity 없음, 집계 쿼리만)
│   │   │   │   │   │   └── work/          #         예산 작업
│   │   │   │   │   ├── council/           #       정보화실무협의회
│   │   │   │   │   └── log/               #       변경 로그
│   │   │   │   │       ├── annotation/    #         LogTarget
│   │   │   │   │       ├── entity/        #         BaseLogEntity + 23개 *L 엔티티
│   │   │   │   │       ├── id/
│   │   │   │   │       └── listener/      #         ChangeLogEntityListener, AuditLogPersister, ApplicationContextHolder, AuditLogEvent
│   │   │   │   ├── infra/                 #     인프라 도메인
│   │   │   │   │   ├── ai/                #       Gemini (controller/dto/service)
│   │   │   │   │   └── file/              #       파일 (controller/dto/entity/repository/service)
│   │   │   │   │       ├── FileValidator.java
│   │   │   │   │       └── FileOwnershipChecker.java
│   │   │   │   ├── exception/             #     GlobalExceptionHandler, CustomGeneralException
│   │   │   │   └── util/
│   │   │   ├── resources/
│   │   │   │   ├── application.properties        #     공통 설정
│   │   │   │   ├── application-dev.properties    #     개발 프로파일
│   │   │   │   └── sql/                          #     수동 SQL 자산 (시드/DDL 단편)
│   │   │   └── webapp/                    #     JSP/SSO 에이전트 자산 (sso/**)
│   │   └── test/
│   │       ├── java/                      #     JUnit 5 테스트
│   │       └── resources/
│   ├── docs/                              #   guides/data-model.md, comment-style.md
│   ├── bin/                               #   IDE 빌드 산출물
│   └── build/                             #   Gradle 빌드 출력
└── it_database/                           # Oracle DB ────────────────
    ├── README.MD                          #   DB 운영 노트
    ├── connect-db.ps1  connect-db.bat     #   sqlplus / SQLcl 접속 헬퍼
    ├── export.par  import.par             #   Data Pump 파라미터
    ├── EXPDAT.DMP                         #   덤프 파일
    └── migrations/                        #   ★ Flyway 마이그레이션
        └── V{YYYYMMDD}_{NNN}__{설명}.sql
```

## Directory Purposes

**`it_frontend/app/` (Nuxt 4 소스 루트):**
- Purpose: 모든 프론트엔드 소스. `~` 별칭이 가리키는 위치
- Contains: Vue 컴포넌트(`.vue`), TypeScript(`.ts`), CSS
- Key files: `app.vue`, `error.vue`, `nuxt.config.ts`(상위 디렉토리)

**`it_frontend/app/pages/`:**
- Purpose: 파일 기반 라우팅 — 파일 경로 = URL 경로
- Contains: 화면 단위 `.vue` 페이지
- Key files: `index.vue`(`/`), `login.vue`(`/login`), `info/projects/[id].vue`(`/info/projects/:id`)
- 동적 라우트: `[id].vue` 형식

**`it_frontend/app/composables/`:**
- Purpose: 재사용 가능한 도메인 로직 (Composition API)
- Contains: `useXxx.ts` 패턴의 함수들 (~40개)
- Key files: `useApiFetch.ts`, `useAuth.ts`, `useProjects.ts`, `useCost.ts`, `useApprovals.ts`, `useBoard.ts`, `useCouncil.ts`, `useAdminTableEdit.ts`

**`it_frontend/app/components/`:**
- Purpose: 재사용 UI 컴포넌트 (도메인별 폴더 + 공통)
- Contains: PascalCase `.vue` 컴포넌트
- Key files: `common/StyledDataTable.vue`, `common/EmployeeSearchDialog.vue`, `AppHeader.vue`, `AppSidebar.vue`, `TiptapEditor.vue`

**`it_frontend/app/stores/`:**
- Purpose: Pinia 전역 상태
- Contains: `auth.ts`(인증), `review.ts`(검토 세션)
- Auto-registered: `nuxt.config.ts`의 `pinia.storesDirs` 설정으로 자동 인식

**`it_frontend/app/middleware/`:**
- Purpose: 라우트 가드
- Contains: `auth.global.ts`(전역 인증), `admin.ts`(관리자 검증), `budget-period.ts`, `plan.ts`
- `.global.ts` 접미사: 모든 라우트에 자동 적용

**`it_frontend/app/plugins/`:**
- Purpose: Nuxt 초기화 시 실행되는 전역 플러그인
- Contains: `auth.ts`(`$apiFetch` provide), `theme.server.ts`, `router-error.client.ts`, `excalidraw-css.client.ts`
- `.server.ts` 접미사: 서버 전용, `.client.ts` 접미사: 클라이언트 전용

**`it_frontend/app/types/` / `app/utils/`:**
- Purpose: TypeScript 타입 정의 / 순수 유틸리티 함수
- Contains: types — `auth.ts`(`ROLE` 상수), `board.ts` 등 도메인별
- utils — `common.ts`(`formatBudget`, `formatDateTime`), `excel.ts`, `hwpx*.ts`, `adminLogs.ts`

**`it_frontend/tests/`:**
- Purpose: Vitest 단위테스트 + Playwright E2E
- Contains: `unit/{components,composables,middleware,plugins,stores,utils}/`, `e2e/*.spec.ts`
- Setup: `setup.ts` (Vitest), `auth.setup.ts` (Playwright)

**`it_backend/src/main/java/com/kdb/it/`:**
- Purpose: Spring Boot Java 소스 루트 (패키지 = `com.kdb.it`)
- Contains: `ItApplication.java` + 하위 패키지

**`it_backend/src/main/java/com/kdb/it/config/`:**
- Purpose: Spring 빈/보안/JPA/Swagger 등 인프라 설정
- Contains: `SecurityConfig`, `JpaAuditConfig`, `QuerydslConfig`, `SwaggerConfig`, `JacksonConfig`, `SsoWebConfig`

**`it_backend/.../common/`:**
- Purpose: 도메인 횡단 공통 모듈
- Contains: `admin/`(시스템관리), `approval/`(결재), `board/`(공통 게시판), `code/`(공통코드), `iam/`(사용자/조직/권한), `system/`(인증·보안), `util/`(`CookieUtil`, `CustomPasswordEncoder`, `HtmlSanitizer`)

**`it_backend/.../domain/`:**
- Purpose: 비즈니스 도메인 (수직 슬라이스 분리)
- Contains: `budget/`(`project/`, `cost/`, `document/`, `plan/`, `status/`, `work/`), `council/`, `log/`, `entity/`(`BaseEntity`)

**`it_backend/.../infra/`:**
- Purpose: 외부 통합/파일 시스템
- Contains: `ai/`(Gemini), `file/`(파일 업로드·다운로드·권한)

**`it_backend/.../exception/`:**
- Purpose: 전역 예외 처리
- Contains: `GlobalExceptionHandler.java`(`@RestControllerAdvice`), `CustomGeneralException.java`

**`it_backend/src/main/resources/`:**
- Purpose: 클래스패스 리소스 (설정 파일, SQL 자산)
- Key files: `application.properties`, `application-dev.properties`, `sql/`(수동 DDL/시드 단편)

**`it_backend/src/main/webapp/`:**
- Purpose: JSP/정적 자산 (SSO 에이전트 페이지 `/sso/**`)

**`it_database/migrations/`:**
- Purpose: Flyway 자동 실행 마이그레이션
- Contains: DDL(테이블/인덱스/시퀀스) + DML(시드/데이터 마이그레이션)
- 멱등성 필수: 재실행 안전

## Key File Locations

**Entry Points:**
- `it_frontend/nuxt.config.ts`: Nuxt 4 전역 설정 (SPA 모드, runtimeConfig, 모듈, 헤더)
- `it_frontend/app/app.vue`: Vue 앱 루트 (`NuxtLayout` + `NuxtPage`)
- `it_frontend/app/pages/index.vue`: 루트 라우트(`/`) → `/info` 리다이렉트
- `it_frontend/app/pages/login.vue`: 로그인 진입 페이지
- `it_backend/src/main/java/com/kdb/it/ItApplication.java`: Spring Boot `main()` + WAR 부트스트랩

**Configuration:**
- `it_frontend/package.json`: npm 의존성 및 스크립트
- `it_frontend/tsconfig.json`: TypeScript 설정 (Nuxt 자동 생성 확장)
- `it_frontend/tailwind.config.js`: Tailwind CSS 토큰
- `it_frontend/eslint.config.mjs`: ESLint flat config
- `it_frontend/vitest.config.ts`: 단위 테스트 러너 설정
- `it_frontend/playwright.config.ts`: E2E 러너 설정
- `it_frontend/.env`: `NUXT_PUBLIC_API_BASE` 등 환경변수
- `it_backend/build.gradle`: Gradle 의존성 및 빌드 설정
- `it_backend/src/main/resources/application.properties`: Spring 공통 설정
- `it_backend/src/main/resources/application-dev.properties`: 개발 프로파일

**Core Logic (Backend):**
- `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java`: 모든 HTTP 진입의 보안 게이트
- `it_backend/src/main/java/com/kdb/it/common/system/security/JwtAuthenticationFilter.java`: JWT 검증 필터
- `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`: 로그인/갱신/로그아웃
- `it_backend/src/main/java/com/kdb/it/common/iam/service/LoginAttemptService.java`: Brute-force 보호
- `it_backend/src/main/java/com/kdb/it/domain/entity/BaseEntity.java`: 모든 업무 엔티티의 부모
- `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java`: 변경 이력 자동 적재
- `it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java`: 전역 오류 → JSON 변환

**Core Logic (Frontend):**
- `it_frontend/app/middleware/auth.global.ts`: 모든 라우트 진입 시 인증 게이트
- `it_frontend/app/middleware/admin.ts`: 관리자 페이지 UX 게이트
- `it_frontend/app/stores/auth.ts`: 인증 상태 + 로그인/갱신/로그아웃 액션
- `it_frontend/app/plugins/auth.ts`: `$apiFetch` 제공 (변경 API용)
- `it_frontend/app/composables/useApiFetch.ts`: `useFetch` 래퍼 (GET용)
- `it_frontend/app/composables/useAuth.ts`: 인증 액션 composable

**Common Components / Utilities:**
- `it_frontend/app/components/common/StyledDataTable.vue`: 모든 DataTable 통일 스타일
- `it_frontend/app/components/common/EmployeeSearchDialog.vue`: 직원 검색 폼
- `it_frontend/app/utils/common.ts`: `formatBudget`, `formatDateTime` 등
- `it_frontend/app/types/auth.ts`: `User`, `ROLE` 상수

**Database:**
- `it_database/migrations/`: Flyway 마이그레이션 (예: `V20260519_006__RecreateBiceDpmCIndex.sql`)
- `it_database/connect-db.ps1`: 로컬 DB 접속 헬퍼
- `it_backend/src/main/resources/sql/`: 수동 DDL/시드 SQL 단편

**Testing:**
- `it_frontend/tests/unit/`: Vitest 단위 테스트 (`components/`, `composables/`, `middleware/`, `plugins/`, `stores/`, `utils/`)
- `it_frontend/tests/e2e/`: Playwright E2E (`auth.spec.ts`, `approval.spec.ts`, `board.spec.ts`, `budget.spec.ts`, `cost.spec.ts`, `documents.spec.ts`, `file-upload.spec.ts`, `access-control.spec.ts`)
- `it_frontend/tests/setup.ts`: Vitest 글로벌 셋업
- `it_frontend/tests/e2e/auth.setup.ts`: Playwright 인증 픽스처
- `it_backend/src/test/java/`: JUnit 5 백엔드 테스트

**Documentation:**
- `C:\it\CLAUDE.md`: 프로젝트 메인 가이드 (SoT 분배표)
- `C:\it\META.md`: 용어사전 (컬럼명·엔티티명 표준)
- `C:\it\DOMAIN.md`: 도메인사전 (컬럼/엔티티 타입)
- `C:\it\TASK.md`: 백로그/기술부채
- `it_backend/CLAUDE.md`: 백엔드 SoT
- `it_frontend/CLAUDE.md`: 프론트엔드 SoT
- `it_backend/docs/guides/data-model.md`: 엔티티 ↔ 테이블 매핑
- `it_frontend/docs/guides/`: 컴포넌트 가이드 (StyledDataTable 등)

## Naming Conventions

**Files (Frontend):**
- Vue 컴포넌트: `PascalCase.vue` (예: `StyledDataTable.vue`, `AppSidebar.vue`)
- 페이지: `kebab-case.vue` 또는 `index.vue` (예: `auth-grades.vue`, `login-history.vue`)
- 동적 라우트: `[param].vue` (예: `pages/info/projects/[id].vue`)
- Composables: `useXxx.ts` (예: `useProjects.ts`, `useApiFetch.ts`)
- Stores: `camelCase.ts` (예: `auth.ts`, `review.ts`)
- 미들웨어: `kebab-case.ts` + `.global` 접미사 (예: `auth.global.ts`)
- 플러그인: 환경 접미사 사용 (`*.server.ts`, `*.client.ts`)
- 타입: `camelCase.ts` (예: `auth.ts`, `budgetStatus.ts`, `tiptapVariable.ts`)
- 유틸: `kebab-case.ts` (예: `hwpx-images.ts`, `hwpx-package-xml.ts`)
- 테스트: `*.test.ts` (Vitest), `*.spec.ts` (Playwright)

**Files (Backend):**
- 모든 Java 파일: `PascalCase.java`
- 엔티티: `<도메인접두사>` 패턴 (예: `Bprojm`, `Bcostm`, `CuserI`, `Capplm`)
- 엔티티 ID (복합키): `<엔티티>Id.java` (예: `BprojmId`, `BcostmId`)
- 로그 엔티티: `*L.java` 접미사 (예: `BprojmL`, `BcostmL`, `CapplmL`)
- 컨트롤러/서비스/리포지토리: `<도메인>Controller.java`, `<도메인>Service.java`, `<도메인>Repository.java`
- 리포지토리 커스텀: `<도메인>RepositoryCustom.java` + `<도메인>RepositoryImpl.java`
- DTO: `<도메인>Dto.java` (정적 중첩 클래스로 요청/응답 묶음)
- 설정: `<목적>Config.java` (예: `SecurityConfig`, `QuerydslConfig`)

**Directories:**
- Frontend: 소문자 + 단수형 (예: `components/`, `pages/`, `composables/`, `stores/`)
- Frontend 도메인 폴더: 소문자 (예: `budget/`, `approval/`, `council/`)
- Backend 패키지: 소문자 (예: `controller/`, `service/`, `repository/`, `entity/`)
- Backend 도메인 패키지: 소문자 (예: `budget/project/`, `domain/log/`, `common/iam/`)

**Database Tables (`it_backend/CLAUDE.md` §5.2):**
- Format: `TPRMPP_{1자리 구분값}{4자리 도메인}{1자리 용도}`
- 1자리 구분값: `C`(공통) / `B`(비즈니스)
- 4자리 도메인: 용도별 (예: `PROJ`, `COST`, `BLBC`)
- 1자리 용도: `M`(마스터) / `L`(로그) / `H`(이력)
- 예시: `TPRMPP_BPROJM`(정보화사업 마스터), `TPRMPP_BPROJL`(정보화사업 로그), `TPRMPP_CLOGNH`(로그인 이력)

**Database Columns (`C:\it\META.md` 기반):**
- 모두 `UPPER_SNAKE_CASE` 약어
- 공통: `DEL_YN`, `GUID`, `GUID_PRG_SNO`, `FST_ENR_DTM`, `FST_ENR_USID`, `LST_CHG_DTM`, `LST_CHG_USID`
- 도메인: META 용어사전 등록 약어만 사용 (예: `BG_AMT` 예산금액, `RMK` 비고, `BBR_C` 부서코드)
- 임의 생성 금지

**Migration Files (`C:\it\CLAUDE.md` §4.4):**
- Format: `V{YYYYMMDD_NNN}__{CamelCase설명}.sql`
- 예시: `V20260516_001__CreateCcodemTable.sql`, `V20260518_001__RenameGclQttToGclQty.sql`

**Functions / Variables (Frontend TS):**
- 함수·변수: `camelCase` (`formatBudget`, `restoreSession`)
- Boolean: `is`/`has`/`should` 접두사 (`isAuthenticated`, `hasAuth`)
- 컴포넌트·타입: `PascalCase` (`User`, `LoginRequest`)
- 상수: `UPPER_SNAKE_CASE` (`ROLE.ADMIN = 'ITPAD001'`)
- Composable: `use` 접두사 (`useProjects`)

**Functions / Variables (Backend Java):**
- 클래스·인터페이스: `PascalCase`
- 메서드·필드·로컬변수·파라미터: `camelCase`
- 상수: `UPPER_SNAKE_CASE`
- 패키지: 전부 소문자

**Endpoints:**
- 베이스: `/api/<도메인>` (예: `/api/projects`, `/api/costs`, `/api/auth`)
- 관리자 전용: `/api/admin/<자원>` 또는 도메인 컨트롤러 클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")`
- 게시판: `/api/boards/{blbMngNo}/posts/**`, `/api/boards/{blbMngNo}/posts/{nacMngNo}/comments/**`

## Where to Add New Code

**New Feature (Backend - 새 도메인):**
- 결정: 공통 vs 비즈니스 → `common/` 또는 `domain/` 선택
- 도메인 폴더: `it_backend/src/main/java/com/kdb/it/domain/<신규도메인>/` 생성
- 하위 구조: `controller/`, `dto/`, `entity/`, `repository/`, `service/` 5개 폴더
- 컨트롤러: `it_backend/src/main/java/com/kdb/it/domain/<도메인>/controller/<도메인>Controller.java` (`@RestController` + `@Tag` + `@RequestMapping("/api/<도메인>")`)
- 서비스: 클래스 레벨 `@Transactional(readOnly=true)` 적용
- 엔티티: `BaseEntity` 상속, `META.md` 등록 약어만 사용
- 로그 엔티티: `BaseLogEntity` 상속한 `*L` 엔티티 추가
- 마이그레이션: `it_database/migrations/V<날짜>_<NNN>__<CamelCase>.sql` 신규 파일
- 관리자 전용이면: 컨트롤러 클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")` 추가

**New Feature (Frontend - 새 화면):**
- 페이지: `it_frontend/app/pages/<도메인>/<화면>.vue` (`<script setup lang="ts">` + `definePageMeta` 필수)
- 도메인 composable: `it_frontend/app/composables/use<도메인>.ts`
- 도메인 컴포넌트: `it_frontend/app/components/<도메인>/<Component>.vue`
- 타입: `it_frontend/app/types/<도메인>.ts`
- 관리자 전용이면: `definePageMeta({ middleware: 'admin' })` + `AppSidebar.vue` 메뉴 항목에 `admin: true` 플래그
- 단위 테스트: `it_frontend/tests/unit/<영역>/<파일>.test.ts`
- E2E: `it_frontend/tests/e2e/<시나리오>.spec.ts`

**New API Endpoint:**
- Backend: 기존 도메인 컨트롤러에 메서드 추가 (`@GetMapping/@PostMapping/@PutMapping/@DeleteMapping` + `@Operation(summary=...)`)
- Mutating(POST/PUT/DELETE): 요청 본문에 `@Valid` 필수
- Service: `@Transactional`(쓰기) 또는 `@Transactional(readOnly=true)`(조회) 적용
- Frontend composable: GET → `useApiFetch`, 변경 → `$apiFetch`
- 부서 필터 필요시: 백엔드 컨트롤러에 `@RequestParam(required=false) String bbrC` + QueryDSL `StringUtils.hasText` 패턴

**New Component:**
- 도메인 공용: `it_frontend/app/components/<도메인>/<Component>.vue`
- 전역 공통: `it_frontend/app/components/common/<Component>.vue` (`Common` 접두사 자동 등록 — 명시적 import 권장)
- DataTable: `StyledDataTable.vue` 래핑 + `useAdminTableEdit` composable 조합

**Utilities:**
- 프론트 순수 유틸: `it_frontend/app/utils/<목적>.ts` (단위 테스트 `tests/unit/utils/<목적>.test.ts` 필수)
- 백엔드 공통 유틸: `it_backend/src/main/java/com/kdb/it/common/util/` (`CookieUtil`, `HtmlSanitizer` 등과 동일 레벨)

**Tests:**
- 백엔드 JUnit: `it_backend/src/test/java/com/kdb/it/<패키지>/...Test.java` (`src/main/java` 패키지 구조 미러링)
- 프론트 Vitest: `it_frontend/tests/unit/<영역>/<파일>.test.ts`
- E2E Playwright: `it_frontend/tests/e2e/<시나리오>.spec.ts`

**Migrations:**
- 위치: `it_database/migrations/`
- 파일명: `V{YYYYMMDD}_{NNN}__{CamelCase설명}.sql`
- 내용: DDL(테이블/인덱스/시퀀스) + DML(시드/데이터 마이그레이션)
- 멱등성 유지 — Flyway는 성공한 스크립트 목록을 추적하므로 수정 금지

**Documentation:**
- 코드에서 확인되는 규칙: 해당 영역 `CLAUDE.md`에 추가
- 휘발성/카운트 정보: `README.md`로
- 백로그: `C:\it\TASK.md` 또는 영역별 `TASK.md`

## Special Directories

**`it_frontend/.nuxt/`:**
- Purpose: Nuxt 빌드 캐시 (개발 모드 산출물)
- Generated: Yes
- Committed: No (`.gitignore`)

**`it_frontend/.output/`:**
- Purpose: 프로덕션 빌드 산출물 (`npm run generate`/`build` 결과)
- Generated: Yes
- Committed: No
- 심볼릭 링크: `it_frontend/dist` → `it_frontend/.output/public`

**`it_frontend/node_modules/`:**
- Purpose: npm 의존성
- Generated: Yes (`npm install`)
- Committed: No

**`it_frontend/coverage/`, `it_frontend/test-results/`, `it_frontend/playwright-report/`:**
- Purpose: 테스트 산출물
- Generated: Yes (Vitest, Playwright)
- Committed: No (ESLint도 제외)

**`it_backend/build/`, `it_backend/bin/`:**
- Purpose: Gradle / IDE 빌드 산출물
- Generated: Yes
- Committed: No

**`it_backend/.gradle/`:**
- Purpose: Gradle 캐시
- Generated: Yes
- Committed: No

**`.planning/codebase/`:**
- Purpose: GSD `/gsd:map-codebase` 자동 생성 분석 문서
- Generated: Yes (이 mapper 에이전트가 생성)
- Committed: 워크플로우 정책에 따름

**`.claude/`, `.bkit/`, `.gstack/`, `.agents/`, `.superpowers/`:**
- Purpose: AI 에이전트/스킬/워크트리 메타데이터
- Generated: Yes (도구별)
- Committed: 부분적 (각 디렉토리의 정책에 따름)

**`pass/`, `fail/`:**
- Purpose: QA 결과 아카이브
- Generated: 수동
- Committed: 정책에 따름

**`it_database/EXPDAT.DMP`:**
- Purpose: Oracle Data Pump 덤프
- Generated: 수동 (`expdp`)
- Committed: 정책에 따름 (대용량)

---

*Structure analysis: 2026-05-19*
