<!-- refreshed: 2026-05-19 -->
# Architecture

**Analysis Date:** 2026-05-19

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Browser (사내 임직원 ~3,000명)                     │
│                  CSR(SPA) - http://localhost:3000                    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ HTTPS + httpOnly Cookies (JWT)
                                   │ credentials: 'include'
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Frontend: Nuxt 4 (SPA, ssr:false)                  │
│                          `it_frontend/`                              │
├──────────────────┬──────────────────┬──────────────────┬────────────┤
│  Pages (Routes)  │   Composables    │  Pinia Stores    │ PrimeVue   │
│  `app/pages/`    │ `app/composables`│  `app/stores/`   │ (Aura UI)  │
└────────┬─────────┴────────┬─────────┴────────┬─────────┴────────────┘
         │                  │                   │
         └──────────────────┴───────────────────┘
                            │
                  $apiFetch / useApiFetch
                  (credentials: 'include')
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│             Backend: Spring Boot 4.0.5 (Java 25)                     │
│                 `it_backend/` (com.kdb.it)                           │
├─────────────────────────────────────────────────────────────────────┤
│  JwtAuthenticationFilter  →  SecurityFilterChain  →  Controllers     │
│  `common/system/security/`    `config/SecurityConfig`                │
├─────────────────────────────────────────────────────────────────────┤
│  Controller Layer  →  Service Layer  →  Repository Layer             │
│  `*/controller/`      `*/service/`       `*/repository/`             │
│  REST 엔드포인트       비즈니스 로직       JPA + QueryDSL              │
├─────────────────────────────────────────────────────────────────────┤
│                       Entity Layer                                   │
│              `*/entity/` + BaseEntity / BaseLogEntity                │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ JPA / QueryDSL
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│      Oracle Database XE (ITPAPP@127.0.0.1:1521/XEPDB1)               │
│      DDL + Flyway Migrations: `it_database/migrations/`              │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  External: Gemini API (`infra/ai/`)  +  File System (`infra/file/`)  │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Nuxt App Root | 레이아웃·라우팅·전역 Toast/Confirm 마운트 | `it_frontend/app/app.vue` |
| Nuxt Config | SPA 모드, runtimeConfig, PrimeVue/Pinia 모듈 등록, 보안 헤더 | `it_frontend/nuxt.config.ts` |
| Global Auth Middleware | 모든 라우트 진입 시 인증 체크 + SSO 리다이렉트 | `it_frontend/app/middleware/auth.global.ts` |
| Admin Middleware | 관리자 페이지 진입 차단(UX) | `it_frontend/app/middleware/admin.ts` |
| Auth Store | `it-portal-user` 쿠키 기반 사용자 상태 | `it_frontend/app/stores/auth.ts` |
| Auth Plugin | `$apiFetch` 제공 + 401 토큰 갱신 재시도 | `it_frontend/app/plugins/auth.ts` |
| API Composable | `useApiFetch` GET 래퍼 (401 처리, 토큰 갱신 신호) | `it_frontend/app/composables/useApiFetch.ts` |
| Spring Boot Entry | JVM 진입점, WAR 배포용 SpringBootServletInitializer | `it_backend/src/main/java/com/kdb/it/ItApplication.java` |
| Security Filter Chain | Stateless JWT 인증, CORS, CSP, URL 권한 | `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java` |
| JWT Filter | 쿠키→Authorization 헤더 폴백, SecurityContext 설정 | `it_backend/src/main/java/com/kdb/it/common/system/security/JwtAuthenticationFilter.java` |
| BaseEntity | 모든 업무 엔티티 공통 필드(`DEL_YN`, `GUID`, audit) + Soft Delete | `it_backend/src/main/java/com/kdb/it/domain/entity/BaseEntity.java` |
| Global Exception Handler | `@RestControllerAdvice`로 통일 JSON 오류 응답 변환 | `it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java` |
| Audit Log Listener | JPA `@PrePersist`/`@PreUpdate` → `*L` 로그 엔티티 저장 | `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java` |

## Pattern Overview

**Overall:** 풀스택 SPA + 레이어드 백엔드 (Frontend = Nuxt 4 SPA / Backend = Spring Boot 레이어드 아키텍처).

**Key Characteristics:**
- **프론트엔드:** Nuxt 4 SPA(`ssr: false`) + 파일 기반 라우팅 + Pinia + PrimeVue + Composition API
- **백엔드:** 패키지별 레이어드 (`controller` → `service` → `repository` → `entity`) + QueryDSL 동적 쿼리
- **인증:** Stateless JWT (httpOnly 쿠키) — 토큰을 프론트에서 직접 저장/읽지 않음
- **공통 엔티티 추상화:** 모든 업무 엔티티가 `BaseEntity` 상속 → Soft Delete + Audit 컬럼 자동 부여
- **변경 이력 자동 적재:** JPA EntityListener 패턴으로 `*L` 로그 테이블에 자동 기록
- **이중 권한 게이트:** Nuxt 미들웨어(UX) + Spring `@PreAuthorize`(보안 경계)

## Layers

**Frontend Layers (Nuxt 4 — `it_frontend/app/`):**

- **Routing / Pages:**
  - Purpose: 파일 기반 라우팅으로 URL ↔ 페이지 매칭
  - Location: `it_frontend/app/pages/`
  - Contains: 화면 단위 `.vue` 파일 (`<script setup lang="ts">`)
  - Depends on: composables, stores, components
  - Used by: Vue Router (Nuxt 자동 생성)

- **Components:**
  - Purpose: 재사용 UI 블록 (도메인별 + 공통)
  - Location: `it_frontend/app/components/`
  - Contains: `StyledDataTable.vue`, `AppSidebar.vue`, 도메인별 폴더(`budget/`, `approval/`, `board/`, `council/`, `cost/`, `plan/`, `projects/`, `review/`, `common/`)
  - Depends on: PrimeVue, composables
  - Used by: pages, 다른 components

- **Composables:**
  - Purpose: 도메인 로직과 API 호출 캡슐화 (`useXxx`)
  - Location: `it_frontend/app/composables/`
  - Contains: `useApiFetch`, `useAuth`, `useProjects`, `useCost`, `useApprovals`, `useBoard`, `useCouncil` 등 ~40개
  - Depends on: `$apiFetch`, stores
  - Used by: pages, components

- **Stores (Pinia):**
  - Purpose: 전역 상태(인증, 검토)
  - Location: `it_frontend/app/stores/`
  - Contains: `auth.ts`, `review.ts`
  - Depends on: Nuxt $fetch (auth.ts), $apiFetch (review.ts)
  - Used by: middleware, composables, pages

- **Middleware:**
  - Purpose: 라우트 가드 (인증, 관리자, 사전조건)
  - Location: `it_frontend/app/middleware/`
  - Contains: `auth.global.ts`, `admin.ts`, `budget-period.ts`, `plan.ts`
  - Used by: Nuxt 라우터

- **Plugins:**
  - Purpose: 전역 부트스트랩 (인증 fetch, 테마, 라우터 에러)
  - Location: `it_frontend/app/plugins/`
  - Contains: `auth.ts` (`$apiFetch` provide), `theme.server.ts`, `router-error.client.ts`, `excalidraw-css.client.ts`

- **Types / Utils:**
  - Location: `it_frontend/app/types/`, `it_frontend/app/utils/`
  - Types: `auth.ts`(`ROLE`), `board.ts`, `budgetStatus.ts`, `budget-work.ts`, `council.ts`, `review.ts`, `tiptapVariable.ts`
  - Utils: `common.ts`(`formatBudget`, `formatDateTime`), `excel.ts`, `hwpx.ts`, `hwpx-images.ts`, `hwpx-package-xml.ts`, `adminLogs.ts`

**Backend Layers (Spring Boot — `it_backend/src/main/java/com/kdb/it/`):**

- **Configuration:**
  - Purpose: 인프라/보안/문서 설정
  - Location: `it_backend/src/main/java/com/kdb/it/config/`
  - Contains: `SecurityConfig.java`, `JpaAuditConfig.java`, `QuerydslConfig.java`, `SwaggerConfig.java`, `JacksonConfig.java`, `SsoWebConfig.java`

- **Controller Layer:**
  - Purpose: REST 엔드포인트, DTO ↔ JSON 매핑, Swagger 문서화, `@PreAuthorize` 권한 검증
  - Location: `it_backend/src/main/java/com/kdb/it/**/controller/`
  - Contains: `ProjectController`, `CostController`, `ApplicationController`, `AdminController`, `AuthController`, `BoardPostController`, `FileController` 등
  - Depends on: Service Layer
  - Used by: HTTP 클라이언트 (Nuxt 프론트, Swagger UI)

- **Service Layer:**
  - Purpose: 비즈니스 로직, 트랜잭션 경계(`@Transactional`), 캐시(`@Cacheable`/`@CacheEvict`)
  - Location: `it_backend/src/main/java/com/kdb/it/**/service/`
  - Contains: `ProjectService`, `CostService`, `AuthService`, `BoardPostService`, `LoginAttemptService`, `BudgetStatusService` 등
  - Depends on: Repository Layer, 다른 Service
  - Used by: Controller Layer, Event Listener

- **Repository Layer:**
  - Purpose: 데이터 접근(JPA + QueryDSL 동적 쿼리)
  - Location: `it_backend/src/main/java/com/kdb/it/**/repository/`
  - Pattern: `JpaRepository` + `*RepositoryCustom` 인터페이스 + `*RepositoryImpl`(QueryDSL)
  - Contains: `ProjectRepository`/`ProjectRepositoryCustom`/`ProjectRepositoryImpl`, `CostRepository`/`Impl`, `UserRepository`/`Impl` 등
  - Depends on: Oracle DB
  - Used by: Service Layer

- **Entity Layer:**
  - Purpose: JPA 엔티티 (DB 테이블 ↔ 객체 매핑)
  - Location: `it_backend/src/main/java/com/kdb/it/**/entity/`
  - Pattern: `BaseEntity` 상속 + `@Column(comment=...)` + Lombok `@SuperBuilder`
  - Examples: `Bprojm`(`TAAABB_BPROJM`), `Bcostm`, `Capplm`, `Cblbcm`, `CuserI`, `CorgnI`
  - Logging: 모든 업무 엔티티에 짝이 되는 `*L` 로그 엔티티 존재 (`BprojmL`, `BcostmL`, `CapplmL` 등 23개)

- **Common Domain:**
  - Location: `it_backend/src/main/java/com/kdb/it/common/`
  - Subdomains: `admin/`, `approval/`, `board/`, `code/`, `iam/`, `system/`, `util/`

- **Business Domain:**
  - Location: `it_backend/src/main/java/com/kdb/it/domain/`
  - Subdomains: `budget/{project,cost,document,plan,status,work}`, `council/`, `log/`, `entity/`

- **Infrastructure:**
  - Location: `it_backend/src/main/java/com/kdb/it/infra/`
  - Subdomains: `ai/`(Gemini), `file/`(파일 업로드/다운로드, 권한 검증)

- **Exception:**
  - Location: `it_backend/src/main/java/com/kdb/it/exception/`
  - Contains: `GlobalExceptionHandler.java`, `CustomGeneralException.java`

## Data Flow

### Primary Request Path (조회: GET 흐름)

1. 사용자가 `it_frontend/app/pages/info/projects/index.vue` 진입 (`it_frontend/app/middleware/auth.global.ts`에서 인증 검사)
2. 페이지 컴포넌트가 `useProjects` composable 호출 (`it_frontend/app/composables/useProjects.ts`)
3. `useApiFetch<Project[]>('/api/projects', { query })` 실행 (`it_frontend/app/composables/useApiFetch.ts`)
4. Nuxt의 `useFetch`가 `credentials: 'include'`로 httpOnly 쿠키 자동 전송 → `${apiBase}/api/projects` 요청
5. Spring Security `FilterChain` 진입 — `JwtAuthenticationFilter` 가 쿠키에서 `accessToken` 추출·검증 (`it_backend/src/main/java/com/kdb/it/common/system/security/JwtAuthenticationFilter.java`)
6. `SecurityContextHolder`에 `CustomUserDetails` 설정 → `ProjectController.list(...)` 실행 (`it_backend/src/main/java/com/kdb/it/domain/budget/project/controller/ProjectController.java:55`)
7. `ProjectController` → `ProjectService.findAll(condition)` 호출
8. `ProjectService` → `ProjectRepositoryImpl`(QueryDSL `BooleanBuilder`로 조건 조립) → JPA → Oracle 쿼리 실행
9. 결과 엔티티 → DTO 변환 → JSON 직렬화 → 200 OK 응답
10. Nuxt `data` ref 갱신 → Vue 반응형 시스템이 화면 재렌더링

### Mutation Path (변경: POST/PUT/DELETE 흐름)

1. 컴포넌트에서 `const { $apiFetch } = useNuxtApp()` 후 `$apiFetch('/api/projects', { method: 'POST', body, ... })` 호출
2. `it_frontend/app/plugins/auth.ts`의 내부 `internalFetch`가 `credentials:'include'`로 전송
3. 401 응답 시: `refreshPromise`를 공유하여 `useAuth().refresh()` 호출 → 새 쿠키 발급 후 원 요청 1회 재시도
4. 백엔드 컨트롤러에서 `@Valid` 검증 → Service 트랜잭션 진입 (`@Transactional`)
5. JPA Dirty Checking으로 변경 감지 → flush 시점에 `ChangeLogEntityListener`가 `AuditLogPersister.persist()` 호출 → `*L` 로그 테이블 INSERT
6. 트랜잭션 커밋 후 컨트롤러가 `201 Created` (Location 헤더 포함) 또는 `204 No Content` 응답
7. 호출자(컴포넌트)에서 PrimeVue `useToast()`로 사용자 피드백 표시

### Authentication Flow

1. `/login` → `AuthController.login(LoginRequest)` 호출
2. `LoginAttemptService.checkLocked(eno)`로 사번 기준 잠금 상태 확인 (`TAAABB_CLOGNH` 5회 실패/10분 잠금)
3. `CustomPasswordEncoder`(SHA-256+Base64, KDB 표준)로 비밀번호 검증
4. `JwtUtil`이 access(15분)/refresh(7일) 토큰 생성 → `CookieUtil`이 httpOnly 쿠키 설정
5. 응답 본문에 사용자 정보(`User`) 반환 → Nuxt `auth.ts`가 `it-portal-user` 쿠키에 저장
6. 이후 모든 API 호출에 쿠키 자동 첨부 → `JwtAuthenticationFilter`가 검증

**State Management:**
- **프론트엔드:** Pinia (전역 인증·검토 상태) + `useCookie<User>('it-portal-user')`로 SSR/CSR 일치
- **백엔드:** Stateless (세션 없음, `SessionCreationPolicy.STATELESS`) — 인증 상태는 JWT 클레임에서 매 요청마다 복원

## Key Abstractions

**BaseEntity:**
- Purpose: 모든 업무 엔티티의 공통 컬럼·동작(Soft Delete, Audit, GUID) 부여
- Examples: `it_backend/src/main/java/com/kdb/it/domain/entity/BaseEntity.java`
- Pattern: JPA `@MappedSuperclass` + Spring Data `@CreatedDate`/`@LastModifiedDate` + Lombok `@SuperBuilder`
- 자동 컬럼: `DEL_YN`, `GUID`, `GUID_PRG_SNO`, `FST_ENR_DTM/USID`, `LST_CHG_DTM/USID`
- Soft Delete: `entity.delete()` → `DEL_YN='Y'` (물리 삭제 금지)

**BaseLogEntity (변경 이력):**
- Purpose: 업무 엔티티 변경 시 자동 적재되는 `*L` 로그 테이블의 공통 기반
- Examples: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BaseLogEntity.java`, 파생: `BprojmL`, `BcostmL`, `CapplmL`, `CcodemL` 등 23개
- Pattern: `BaseEntity` + `@EntityListeners(ChangeLogEntityListener.class)` 조합으로 `@PrePersist`/`@PreUpdate` 콜백에서 자동 저장

**Repository Custom + QueryDSL:**
- Purpose: 동적·복잡 검색 쿼리를 타입 안전하게 조립
- Pattern: `JpaRepository<E, ID>` + `RepositoryCustom`(인터페이스) + `RepositoryImpl extends QuerydslRepositorySupport`
- Examples: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepositoryImpl.java`, `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepositoryImpl.java`, `it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepositoryImpl.java`

**DTO 정적 중첩 클래스:**
- Purpose: 도메인별 요청/응답 DTO를 한 파일로 묶어 추적성 확보
- Pattern: `public class XxxDto { public static class LoginRequest {} ... }` + `@Schema` 필수
- Examples: `it_backend/src/main/java/com/kdb/it/common/system/dto/AuthDto.java`, `it_backend/src/main/java/com/kdb/it/common/iam/dto/UserDto.java`

**useApiFetch / $apiFetch 분리:**
- Purpose: GET(반응형)과 변경(일회성) 트래픽의 401 처리·재시도 흐름을 분리
- Pattern: `useApiFetch` (`useFetch` 래퍼, watch 신호로 재요청) vs `$apiFetch` (`$fetch` 래퍼, 동시 401 refreshPromise 공유)
- Examples: `it_frontend/app/composables/useApiFetch.ts`, `it_frontend/app/plugins/auth.ts`

**StyledDataTable + useAdminTableEdit:**
- Purpose: 모든 DataTable의 시각·편집 패턴 통일 (파란 헤더/gridlines/resizable)
- Examples: `it_frontend/app/components/common/StyledDataTable.vue`, `it_frontend/app/composables/useAdminTableEdit.ts`
- 행 상태: `_status` (new/modified/deleted), `_localId` (신규 행 식별)

## Entry Points

**Backend JVM Main:**
- Location: `it_backend/src/main/java/com/kdb/it/ItApplication.java`
- Triggers: `./gradlew bootRun` 또는 `java -jar ooo.war` (외장 WAS 배포 시 `SpringBootServletInitializer.configure` 호출)
- Responsibilities: Spring Boot 컨텍스트 부트스트랩, 내장 Tomcat 구동

**Backend HTTP Entry:**
- Location: `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java` 필터 체인 진입
- Triggers: 모든 HTTP 요청 (포트 8080)
- Responsibilities: CORS → CSP/HSTS 헤더 → CSRF off → STATELESS 세션 → URL 권한 → JWT 필터 → 컨트롤러

**Backend Auth Endpoints:**
- Location: `it_backend/src/main/java/com/kdb/it/common/system/controller/AuthController.java`
- Triggers: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `POST /api/auth/signup`(관리자만)
- Responsibilities: 비밀번호 검증, JWT 발급, httpOnly 쿠키 설정, 로그인 이력 기록

**Frontend Root:**
- Location: `it_frontend/nuxt.config.ts`
- Triggers: `npm run dev` (개발) / `npm run generate` (운영 정적 빌드, SPA)
- Responsibilities: Nuxt 4 SPA 모드 활성화(`ssr:false`), 모듈 등록(PrimeVue, Pinia, Tailwind), runtimeConfig(`apiBase`), 보안 헤더, FOUC 방지 인라인 스크립트

**Frontend App Root:**
- Location: `it_frontend/app/app.vue`
- Triggers: Nuxt 4가 자동 로드
- Responsibilities: `NuxtLayout`+`NuxtPage` 마운트, 전역 `ConfirmDialog`/`Toast` 배치

**Frontend Route Entry:**
- Location: `it_frontend/app/pages/index.vue` → `/info` 리다이렉트
- Triggers: 사용자가 `/` 진입
- Pre-handlers: `auth.global.ts` (전역 인증 미들웨어)
- Responsibilities: 인증 검증 → 비로그인 시 `/login` 또는 SSO 리다이렉트 → 인증 사용자는 `/info`(정보화 대시보드)

**Login Page:**
- Location: `it_frontend/app/pages/login.vue`
- Triggers: 비인증 사용자, SSO 콜백
- Responsibilities: 로그인 폼 + SSO 핸드오프

## Architectural Constraints

- **Threading:** Spring Boot 기본 서블릿 스레드 풀 (Tomcat 내장). 외부 호출이 길어질 수 있는 `GeminiService.generate()`는 의도적으로 별도 트랜잭션 경계 없이 흐름을 분리해 DB 트랜잭션을 점유하지 않도록 설계 (`it_backend/src/main/java/com/kdb/it/infra/ai/service/GeminiService.java`).
- **Stateless 인증:** Spring Security `SessionCreationPolicy.STATELESS`. 세션 ID를 발급하지 않으며 모든 요청 컨텍스트는 JWT 클레임에서 복원.
- **글로벌 상태(프론트):** 모듈 레벨 `let isRefreshing`, `let networkErrorLastShown`, `const tokenRefreshSignal = ref(0)` (`it_frontend/app/composables/useApiFetch.ts`) — 모든 `useApiFetch` 인스턴스가 공유하는 의도적 글로벌. 동시 401 응답 시 토큰 갱신 중복 방지가 목적.
- **모듈 레벨 refreshPromise:** `it_frontend/app/plugins/auth.ts` 내 `let refreshPromise: Promise<boolean> | null` — 동시 401 요청 합치기.
- **순환 의존:** `stores/auth.ts`는 `$apiFetch` 사용 금지 (auth 플러그인이 `useAuth`를 의존하므로 순환). 로그인/갱신/로그아웃은 Nuxt 내장 `$fetch` + `credentials:'include'` 직접 호출.
- **이중 권한 게이트 필수:** 관리자 화면은 `definePageMeta({ middleware: 'admin' })` + 백엔드 `@PreAuthorize("hasRole('ADMIN')")` 모두 적용. 미들웨어 단독은 보안 경계가 아님.
- **물리 삭제 금지:** 모든 업무 엔티티는 `entity.delete()`로 Soft Delete만 허용. 물리 삭제는 마이그레이션 외 사용 불가.
- **엔티티 명명 강제:** 컬럼명·엔티티명은 `C:\it\META.md` 용어사전 + `C:\it\DOMAIN.md` 도메인사전 기준. 임의 생성 금지.

## Anti-Patterns

### 프론트에서 토큰 직접 보관

**What happens:** `localStorage` 또는 `useCookie('accessToken')`에 JWT 저장 시도.
**Why it's wrong:** httpOnly 쿠키 정책을 위반하면 XSS 공격면이 직접 노출됨. `it_frontend/CLAUDE.md` §4.4 명시.
**Do this instead:** `useCookie<User>('it-portal-user')`로 사용자 표시 정보만 저장하고, 토큰은 백엔드가 `CookieUtil`로 발급한 httpOnly 쿠키에만 둠 (`it_backend/src/main/java/com/kdb/it/common/util/CookieUtil.java`).

### 관리자 API를 미들웨어만으로 보호

**What happens:** Nuxt `middleware/admin.ts`만 적용하고 백엔드에 `@PreAuthorize` 누락.
**Why it's wrong:** SPA 미들웨어는 브라우저에서 우회 가능. 비관리자가 API 직접 호출해 데이터 변조 가능.
**Do this instead:** 컨트롤러 클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")` 적용. 현재 적용 대상: `PlanController`, `BudgetStatusController`, `BudgetWorkController`, `AdminBoardMetaController`, `GeminiController` (`it_backend/CLAUDE.md` §5.6).

### `console.log` / `console.error` 단독 사용

**What happens:** API 실패 시 `console.error(err)` 만 호출하고 사용자 피드백 없음.
**Why it's wrong:** 사용자가 실패를 인지하지 못함. 운영 디버깅에도 부적합.
**Do this instead:** PrimeVue `useToast()`로 사용자 친화적 메시지 표시. 패턴은 `it_frontend/CLAUDE.md` §4.2.1 참조.

### 스토어 액션 내부 toast 호출

**What happens:** Pinia 스토어 액션의 catch 블록에서 `toast.add(...)` 직접 호출.
**Why it's wrong:** UI 의존을 스토어에 주입하면 테스트성 저하. 동일 액션이 다른 컨텍스트에서 호출될 때 toast 중복.
**Do this instead:** 스토어는 에러를 호출자에게 throw. 컴포넌트/composable의 try-catch에서 toast 처리 (`it_frontend/CLAUDE.md` §4.8.1).

### v-html 직접 바인딩

**What happens:** 서버 응답 HTML을 `<div v-html="content" />`로 그대로 렌더링.
**Why it's wrong:** XSS 취약점. 백엔드의 `HtmlSanitizer.sanitize()`가 누락된 경로 발생 시 즉시 노출.
**Do this instead:** `<div v-html="DOMPurify.sanitize(content)" />` — `isomorphic-dompurify` 사용 (`it_frontend/CLAUDE.md` §4.5).

### 임의 엔티티/컬럼명 명명

**What happens:** 엔티티 컬럼을 `deleted_flag`, `is_active` 등 임의 명명.
**Why it's wrong:** 사내 메타·도메인 표준(`META.md`, `DOMAIN.md`) 위반. 마이그레이션/감사 도구가 일관성 가정 위에 동작.
**Do this instead:** `META.md` 용어사전에 등록된 약어(`DEL_YN`, `FST_ENR_DTM`)만 사용. 신규 컬럼은 사전에 메타 등록.

### 물리 삭제 (`repository.delete(entity)`)

**What happens:** `JpaRepository.delete()` 호출로 레코드 즉시 삭제.
**Why it's wrong:** 변경 이력 추적 불가. 감사·복원 요구사항 충족 못 함.
**Do this instead:** `entity.delete()` 호출 후 `save()` — `DEL_YN='Y'`. 모든 조회 쿼리는 `DEL_YN='N'` 필터 필수.

## Error Handling

**Strategy:** 계층별 명시적 처리 + 글로벌 핸들러 보강.

**Patterns:**
- **백엔드 글로벌:** `@RestControllerAdvice GlobalExceptionHandler` (`it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java`)가 `CustomGeneralException`, `IllegalArgumentException`, `IllegalStateException` → 400, `Exception` → 500으로 통일된 JSON `{timestamp, status, message}` 반환.
- **백엔드 도메인:** 비즈니스 규칙 위반은 `IllegalStateException` (예: "결재중 프로젝트 수정 불가"). 미존재 자원은 `IllegalArgumentException`.
- **백엔드 보안:** `SecurityConfig`의 `authenticationEntryPoint` → 401, `accessDeniedHandler` → 403.
- **프론트 자동:** `useApiFetch`/`$apiFetch`가 401 자동 감지 → `useAuth().refresh()` → 성공 시 재시도, 실패 시 `/login` 리다이렉트.
- **프론트 사용자 피드백:** PrimeVue `useToast({ severity: 'error', summary: '오류', detail: error?.data?.message || '...' })`.
- **프론트 라우터:** `it_frontend/app/error.vue` (전역 에러 페이지) + `plugins/router-error.client.ts` (라우터 예외).

## Cross-Cutting Concerns

**Logging:**
- 백엔드: SLF4J + Spring Boot 기본 Logback. `LoggerFactory.getLogger(...)` 패턴.
- 감사: `ChangeLogEntityListener` → `AuditLogPersister` → `*L` 로그 테이블 자동 적재 (`it_backend/src/main/java/com/kdb/it/domain/log/listener/`).
- 로그인 이력: `TAAABB_CLOGNH` (`it_backend/src/main/java/com/kdb/it/common/system/entity/Clognh.java`).

**Validation:**
- 백엔드: Bean Validation `@Valid` + DTO 어노테이션(`@NotBlank`, `@Size`). mutating 엔드포인트 필수 (`it_backend/CLAUDE.md` §5.5.2).
- 프론트: 폼 단계 검증 + 백엔드 응답 메시지를 toast로 표시.
- HTML: 백엔드 저장 전 `HtmlSanitizer.sanitize()` (`it_backend/src/main/java/com/kdb/it/common/util/HtmlSanitizer.java`), 프론트 렌더 시 `DOMPurify.sanitize()`.
- 파일: `FileValidator.validateExtension()` (`it_backend/src/main/java/com/kdb/it/infra/file/FileValidator.java`) + `FileOwnershipChecker` (`it_backend/src/main/java/com/kdb/it/infra/file/FileOwnershipChecker.java`).
- 환경: `EnvironmentValidator` (`it_backend/src/main/java/com/kdb/it/common/system/EnvironmentValidator.java`) `@PostConstruct`에서 `spring.datasource.password`, `jwt.secret` 검사.

**Authentication / Authorization:**
- JWT 인증: `JwtAuthenticationFilter` → `CustomUserDetails` → `SecurityContext` (`it_backend/src/main/java/com/kdb/it/common/system/security/`).
- 권한 모델: RBAC — 자격등급(`CauthI`) + 역할 매핑(`CroleI`). `ITPAD001`(시스템관리자), `ITPZZ001`(일반사용자), `ITPZZ002`(기획통할담당자).
- URL 패턴: `/api/admin/**`, `/api/plan/**` → `hasRole('ADMIN')`. 그 외 인증 필요.
- 메서드 어노테이션: `@EnableMethodSecurity` + 클래스/메서드 레벨 `@PreAuthorize`.
- Brute-force: `LoginAttemptService` 5회/10분 (DB 이력 기반).

**Transaction:**
- 클래스 레벨 `@Transactional(readOnly=true)` (조회 위주 서비스) + 쓰기 메서드만 `@Transactional` 오버라이드.
- JPA Dirty Checking 우선 (불필요한 `save()` 회피).
- 이벤트: `@EventListener`(동기·트랜잭션 공유) vs `@TransactionalEventListener`(커밋 후 비동기). 결재→협의회 상태 전이는 `CouncilApprovalEventListener`에서 `@EventListener` 사용 (`it_backend/src/main/java/com/kdb/it/common/approval/event/`).

**Caching:**
- 공통코드 캐시: `CodeService` `@Cacheable('codesByCid', 'budgetPeriod')`. 쓰기 시 `@CacheEvict(allEntries=true)` 필수.

---

*Architecture analysis: 2026-05-19*
