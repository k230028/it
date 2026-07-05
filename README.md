# IT Project Portal — 모노레포 개발 가이드

## 1. 프로젝트 개요

**IT Project Portal (IT 정보화 포탈)**  
약 3,000명의 임직원이 이용하는 정보화 예산, 사업, 인력 관리 사내 포털 시스템

**주요 기능:**
- 정보화사업 CRUD 및 전자결재 프로세스
- 예산 관리(전산예산, 전산업무비, 경상사업, 예산현황 조회)
- 요구사항 정의서 및 사전협의(문서 검토 코멘트)
- 정보화실무협의회(타당성검토, 위원선정, 평가, 결과)
- 공통 게시판(게시판 메타, 게시물, 댓글, 답변글)
- `@LogTarget` 업무 엔티티 변경 이력 자동 추적

**기술 스택:**
- **프론트엔드:** Nuxt 4 (Vue 3 Composition API) + PrimeVue + Tailwind CSS (CSR 모드)
- **백엔드:** Spring Boot 4 (Java 25) + Oracle Database 21c XE + JPA/QueryDSL
- **인증:** JWT httpOnly 쿠키 기반 (Access Token 15분 / Refresh Token 7일)
- **외부 연동:** Gemini AI (텍스트 생성), SSO(선택적)
- **소스 통계:** 백엔드 377개 Java 파일 + 164개 테스트 + 84개 엔티티, 프론트엔드 84개 컴포넌트 + 62개 composable/helper + 67개 페이지

---

## 2. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  Nuxt 4 (CSR)  http://localhost:3000                        │
│  - 67개 페이지, 84개 컴포넌트, 62개 composable/helper      │
│  - Pinia 상태관리 (인증, 사전협의)                          │
│  - PrimeVue + Tailwind CSS 스타일링                        │
└─────────────────────────────────────────────────────────────┘
                    ↕ API (httpOnly 쿠키)
┌─────────────────────────────────────────────────────────────┐
│  Spring Boot 4  http://localhost:28080                        │
│  - 19개 도메인 + 8개 공통 모듈                              │
│  - 377개 Java 파일, 164개 테스트 파일                      │
│  - JWT 인증 + RBAC + Soft Delete                            │
│  - JPA 리스너 기반 변경 감사로그 자동 추적                  │
└─────────────────────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────────────────────┐
│  Oracle Database 21c XE  XEPDB1 (ITPAPP)                   │
│  - 80개 JPA 엔티티                                           │
│  - Flyway 마이그레이션                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2.1 모노레포 디렉토리 구조

```
it/
├── it_frontend/          ← Nuxt 4 웹 애플리케이션 (CSR 모드)
│   ├── README.md         ← 프론트엔드 상세 가이드 (기술 스택, 패턴, 테스트)
│   ├── CLAUDE.md         ← 프론트 기술 결정 & API 맵 (개발 표준)
│   ├── app/              ← 소스 루트 (Nuxt 4 convention)
│   │   ├── pages/        ← 파일 기반 라우팅 (67개 페이지)
│   │   ├── components/   ← 재사용 컴포넌트 (84개)
│   │   ├── composables/  ← 비즈니스 로직 & API 래퍼 (60개)
│   │   ├── stores/       ← Pinia 상태관리 (인증, 사전협의)
│   │   ├── types/        ← TypeScript 타입 정의 (15개)
│   │   ├── utils/        ← 유틸리티 함수 (금액포맷, PDF/Excel/HWPX 변환)
│   │   └── middleware/   ← 라우트 가드 (인증, 관리자 접근 제어)
│   └── tests/            ← Vitest + Playwright 테스트 (101개 unit, 16개 e2e)
│
├── it_backend/           ← Spring Boot 4 REST API 서버
│   ├── README.md         ← 백엔드 상세 가이드 (아키텍처, API, 환경 설정)
│   ├── CLAUDE.md         ← 백엔드 기술 결정 & 보안 정책 (SoT)
│   ├── src/main/java/    ← 소스 코드 (377개 파일)
│   │   └── com/kdb/it/
│   │       ├── config/   ← Spring 설정 (보안, JPA, Swagger 등)
│   │       ├── common/   ← 공통 모듈 (인증, 게시판, 결재, 알림)
│   │       ├── domain/   ← 비즈니스 도메인 (예산, 사업집행 4단계, 협의회, 문서, 로그)
│   │       ├── infra/    ← 외부 연동 (파일, Gemini AI, EAI 표준전문)
│   │       └── exception/ ← 전역 예외 처리
│   ├── src/test/java/    ← JUnit 5 + Mockito 테스트 (164개 파일)
│   └── build.gradle      ← Gradle 빌드 스크립트 (Spring Boot 4.1.0)
│
├── it_database/          ← Oracle DB 마이그레이션 & 초기화
│   ├── migrations/       ← Flyway SQL 마이그레이션 (V{YYYYMMDD_NNN} 형식)
│   └── seeds/            ← 초기 데이터 (공통코드, 사용자)
│
├── docs/                 ← 문서, 리포트, 워크플로우 산출물
│   └── superpowers/      ← Superpowers 계획·스펙·검증 산출물
│
├── CLAUDE.md             ← 모노레포 공통 규약 (인증 SoT, 주석, 게시판 규칙)
├── TASK.md               ← 미구현 기능, 기술 부채, 보안 강화 과제
├── README.md             ← 이 파일 (프로젝트 개요 & 빠른 시작)
└── .agents/              ← AI 에이전트 확장 설정
```

## 3. 로컬 개발 환경 설정

### 3.1 필수 요구사항

| 항목 | 버전 | 설치 방법 |
|------|------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| Java | 25 | JDK 25 설치, `JAVA_HOME` 환경변수 설정 |
| Oracle Client | 21c+ | [Oracle Database Express Edition](https://www.oracle.com/database/technologies/xe-downloads.html) |
| Git | 2.30+ | 기본 설치 |
| Gradle | 내장 | `./gradlew` (Gradle Wrapper 사용) |

환경변수 세팅
```Bash
C:\> setx SPRING_PROFILES_ACTIVE "local-ext"  # local-ext / local-int / dev / prod
C:\> setx GRADLE_USER_HOME "C:\it\.gradle"  # 운영 서버는 /sw/itpapp/.gradle
C:\> setx DB_PASSWORD "kdb1234!!"
C:\> setx JWT_SECRET "HFRw7fQsWNFy9FULDWhh9e1ace1QlspznnCDBXZafb64l3hIGVYjhb27IWEeZ0/J46kpq6J8NidyKNO2FT5niQ=="
C:\> setx APP_FRONTEND_URL "http://localhost:3000"   :: (백엔드) SSO 복귀 + CORS 허용 오리진 (이 값 하나가 둘 다 결정)
C:\> setx NUXT_PUBLIC_API_BASE "http://localhost:28080"  :: (프론트) 백엔드 API/SSO 주소. 커밋된 .env 기본값을 덮어씀
C:\> setx GEMINI_API_KEY "실제_API_키"      :: Gemini 사용 시
C:\> setx EAI_URL "https://eai.kdb.internal/..."  :: EAI 운영 시
```

> [!important] SSO/CORS — 프론트 URL 환경변수(`APP_FRONTEND_URL`)
> - 백엔드는 이 값 **하나**로 **SSO 완료 후 복귀 대상**(`app.frontend-url`)과 **CORS 허용 오리진**(`cors.allowed-origins`)을 함께 설정합니다. 미설정 시 둘 다 비어 SSO 복귀가 백엔드로 잘못 가고 모든 `/api` 호출이 CORS로 차단됩니다.
> - 여러 오리진이 필요할 때만 `CORS_ALLOWED_ORIGINS`(콤마 구분)로 CORS만 따로 오버라이드합니다.
> - **반드시 프론트가 실제 접속되는 origin과 정확히 일치**(스킴·호스트·포트, 끝 슬래시 없음). 예: 로컬은 `http://localhost:3000`.
> - **내부망에서 IP로 테스트**할 때는 프론트를 **백엔드와 같은 호스트**로 접속해야 합니다. SSO 인증 쿠키는 호스트 기준(포트 무관)이라, 백엔드가 `10.9.16.109`면 프론트도 `http://10.9.16.109:3000`으로 접속하고 `APP_FRONTEND_URL=http://10.9.16.109:3000`으로 맞춰야 인증 쿠키가 공유되어 로그인 루프가 끊깁니다(`localhost:3000`은 호스트가 달라 쿠키 미공유). 이때 프론트가 호출할 백엔드 주소도 OS 환경변수 `NUXT_PUBLIC_API_BASE=http://10.9.16.109:28080`으로 지정합니다(커밋된 `it_frontend/.env`의 localhost 기본값을 덮어씀 — **.env 파일은 수정하지 않습니다**). c12 로더가 이미 존재하는 OS 환경변수를 .env로 덮어쓰지 않으므로 환경변수가 항상 우선합니다.

[참고] JWT_SECRET 생성
```Bash
cd it_backend\scripts

# 1) 기본: 512비트(64바이트) 시크릿 생성 → 화면 출력
.\generate-jwt-secret.ps1

# 2) 최소 길이(256비트) 생성
.\generate-jwt-secret.ps1 -Bytes 32

# 3) 생성과 동시에 사용자 환경변수 JWT_SECRET 등록
.\generate-jwt-secret.ps1 -SetEnv

# 4) 시스템 전역 환경변수로 등록 (관리자 권한 필요)
.\generate-jwt-secret.ps1 -SetEnv -Machine
```

### 3.2 로컬 빠른 시작 (3터미널)

Git 설치 후 설정

```bash
C:\>git clone https://github.com/gonnabe88/it.git
C:\>cd it
C:\it>git clone https://github.com/gonnabe88/it_backend.git
C:\it>git clone https://github.com/gonnabe88/it_frontend.git
C:\it>git clone https://github.com/gonnabe88/it_database.git

PS C:\it> git config user.name "K140024(KDB)" # 각 폴더별 설정
PS C:\it> git config user.email "jjong@kdb.co.kr" # 각 폴더별 설정
```

**터미널 1: 프론트엔드 (포트 3000, CSR)**
```bash
cd it_frontend
npm install              # 최초 1회 (npm ci 권장)
npm run postinstall      # 타입 정의 생성
npm run dev
# → http://localhost:3000 (자동 브라우저 오픈)
```

**터미널 2: 백엔드 (포트 28080, REST API)**
```bash
cd it_backend
# 환경변수 설정 (Windows PowerShell)
$env:DB_PASSWORD = "your-db-password"
$env:JWT_SECRET = "your-jwt-secret-key"
$env:APP_FRONTEND_URL = "http://localhost:3000"   # SSO 복귀 + CORS 허용 오리진(둘 다 이 값)

./gradlew bootRun       # Windows: .\gradlew.bat bootRun
# → http://localhost:28080
# → Swagger UI: http://localhost:28080/swagger-ui/index.html
```

**터미널 3: Oracle DB (선택, 스키마 확인용)**
```bash
sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1   # 기본 자격증명 (Spring Boot 개발 설정과 동일)
```

### 3.3 개발 품질 확인 (Health Stack)

모든 명령어는 **각 디렉토리에서 실행**합니다.

```bash
# 프론트엔드 (it_frontend/)
npm run typecheck       # TypeScript 타입 체크
npm run lint           # ESLint + Prettier
npm test               # Vitest 단위 테스트
npm run test:watch     # 파일 변경 감지

# 백엔드 (it_backend/)
./gradlew test         # JUnit 5 + Mockito 테스트
./gradlew jacocoTestReport  # 커버리지 리포트
./gradlew build        # 전체 빌드 (test 포함)
./gradlew clean build  # 클린 빌드
```

**커버리지 목표:** 프론트엔드 80% 이상, 백엔드 70% 이상 (JaCoCo)

### 3.4 설치

git cli
```bash
C:\Users\gonna>winget install --id GitHub.cli
찾음 GitHub CLI [GitHub.cli] 버전 2.92.0
이 응용 프로그램의 라이선스는 그 소유자가 사용자에게 부여했습니다.
Microsoft는 타사 패키지에 대한 책임을 지지 않고 라이선스를 부여하지도 않습니다.
다운로드 중 https://github.com/cli/cli/releases/download/v2.92.0/gh_2.92.0_windows_amd64.msi
  ██████████████████████████████  14.0 MB / 14.0 MB
설치 관리자 해시를 확인했습니다.
패키지 설치를 시작하는 중...
설치 성공

C:\Users\gonna>gh auth login
? Where do you use GitHub? GitHub.com
? What is your preferred protocol for Git operations on this host? HTTPS
? Authenticate Git with your GitHub credentials? Yes
? How would you like to authenticate GitHub CLI? Login with a web browser

! First copy your one-time code: 670E-11EE
Press Enter to open https://github.com/login/device in your browser...
✓ Authentication complete.
- gh config set -h github.com git_protocol https
✓ Configured git protocol
✓ Logged in as gonnabe88
```

---

## 4. 핵심 기술 결정 (Architecture & Design)

### 4.1 프론트엔드 CSR(SPA) 모드

**설정:** `nuxt.config.ts`의 `ssr: false`

**이유:**
- 초기 SSG(`npm run generate`) 시도 시 Pinia 스토어 `user=null`이 하이드레이션 타이밍에 쿠키 기반 인증을 덮어쓰는 문제 발생
- 사내 포털(SEO 불필요) → CSR 최적
- 모든 라우트가 동일 `index.html`에서 클라이언트 라우팅

**배포:** `npm run generate` 후 정적 파일을 nginx/Apache에서 서빙. 모든 경로를 `index.html`로 라우팅.

### 4.2 JWT httpOnly 쿠키 인증 (보안)

**정책:** 프론트엔드가 토큰 문자열을 직접 저장/읽지 않음

| 항목 | 설정 |
|------|------|
| Access Token | 15분 (httpOnly 쿠키) |
| Refresh Token | 7일 (httpOnly 쿠키) |
| 사용자 정보 | `it-portal-user` 쿠키 (JSON, 표시용) |
| 인증 API 호출 | `credentials: 'include'` 필수 |

**흐름:**
1. POST `/api/auth/login` (사번/비밀번호)
2. 백엔드가 JWT를 httpOnly 쿠키에 설정
3. 프론트는 `useCookie('it-portal-user')`로 로컬 상태 복원
4. 401 응답 시 자동 refresh 후 원요청 재시도 (plugin/auth.ts)

**설명:** JavaScript에서 XSS 시 접근 불가 → XSS 방어의 첫 번째 계층

### 4.3 관리자 접근 제어 (3계층)

| 계층 | 기술 | 역할 |
|------|------|------|
| **1. 라우트 가드** | `middleware/admin.ts` | 미권한 사용자 `/login` 리다이렉트 (UX) |
| **2. 메뉴 숨김** | DB 메뉴 권한 매핑(`Cmenua`) + `useMenu()` 서버 필터링 | 비관리자 메뉴 불표시, 관리자 전용 메뉴는 왕관 아이콘 표시 (UX) |
| **3. API 보안** | `@PreAuthorize("hasRole('ADMIN')")` | API 직접 호출 차단 **(진정한 보안 경계)** |

**주의:** 1, 2번은 UX 보호일 뿐. **백엔드 API 보호가 최종 보안 경계**입니다. 비관리자가 개발자도구에서 쿠키 조작 후에도 API 호출 불가능해야 합니다.

### 4.4 변경 로그 (Audit Log) — 자동 추적

**대상:** `@LogTarget` 부착 업무 엔티티 전체 (짝이 되는 `*L` 로그 엔티티가 `BaseLogEntity` 상속)

**메커니즘:**
- JPA `@PrePersist`/`@PreUpdate` 콜백 → `ChangeLogEntityListener` → `AuditLogPersister` → DB 저장
- Soft Delete(`DEL_YN='Y'`) 자동 감지
- 변경자, 변경일시, 변경유형(C/U/D) 자동 기록

**특징:**
- 로그 저장 실패는 원본 작업 롤백을 피하도록 catch 처리
- `*L` 로그 엔티티 (예: BprojmL, CcodemL, CapplmL)

### 4.5 이중 API 호출 패턴

| 패턴 | Composable | 용도 | 특징 |
|------|-----------|------|------|
| GET 조회 | `useApiFetch<T>` | 목록/상세 조회 | 반응형(reactive), 자동 캐싱, 중복 호출 방지 |
| 변경 | `$apiFetch` | POST/PUT/DELETE | 일회성, 이벤트 핸들러에서 명시적 호출 |

**인증 및 에러 처리:**
- 둘 다 자동으로 `credentials: 'include'` 설정 (httpOnly 쿠키 전송)
- 401 응답 시 `plugin/auth.ts` 인터셉터 → refresh() → 원요청 재시도
- refresh 실패 시 `/login` 리다이렉트

**주의:** `stores/auth.ts` 내부에서는 `$apiFetch` 사용 불가 (순환 참조). 대신 Nuxt 내장 `$fetch` + `credentials: 'include'` 직접 사용.

## 5. 서비스 구성 & URL

| 서비스 | 개발 환경 | 운영 환경 | 설명 |
|--------|---------|---------|------|
| **프론트엔드** | http://localhost:3000 | https://it.kdb.co.kr:20443 | Nuxt 4 CSR (정적 생성) |
| **백엔드 API** | http://localhost:28080 | http://localhost:28080 | Spring Boot 4 REST API |
| **Swagger UI** | http://localhost:28080/swagger-ui/index.html | 동일 | OpenAPI 3.0 자동 문서화 |
| **Oracle DB** | 127.0.0.1:11521/XEPDB1 (ITPAPP) | 운영 배포 설정 | 데이터 저장소 |

**포트 설정:**
- **프론트엔드**: `nuxt.config.ts`에서 `devServer.host`, `devServer.port` 확인
- **백엔드**: `application.properties`의 `server.port=28080` 확인
- **Oracle**: 11521 (로컬 XE 리스너 포트 변경 적용, 변경 절차는 `it_database/README.MD` §4 참조)

---

## 6. 핵심 도메인 및 API 매핑

### 6.1 백엔드 주요 도메인 (Spring Boot 4 기반)

| 도메인 | 패키지 | 설명 | 주요 엔티티 |
|--------|--------|------|-----------|
| **인증·보안** | `common/system` | JWT, 로그인 이력, Brute-force 보호 | CuserI, Crtokm, Clognh |
| **사용자·조직** | `common/iam` | RBAC, 자격등급, 역할 매핑 | CuserI, CorgnI, CauthI, CroleI |
| **결재** | `common/approval` | 전자결재 프로세스, 상태 전이 | Capplm, Cappla, Cdecim |
| **공통 게시판** | `common/board` | 게시판 메타, 게시물, 댓글 | Cblbmm, Cblbcm, Ccmmtm |
| **공통코드** | `common/code` | 코드 관리, 캐싱 | Ccodem |
| **알림** | `common/notification` | 인앱/이메일/SMS/톡 알림 | Cinfmm |
| **실시간 로그** | `common/admin/realtime` | 변경 로그 스냅샷 조회 (관리자 전용) | V_ITPAPP_LOG_FEED |
| **정보화사업** | `budget/project` | 사업 CRUD, 복합키 | Bprojm, Bitemm |
| **전산업무비** | `budget/cost` | 비용 항목, 단말기 | Bcostm, Btermm |
| **요구사항·검토** | `budget/document` | 가이드/요구사항 정의서, 검토의견 | Bgdocm, Brdocm, Brivgm |
| **예산 관리** | `budget/plan`, `status`, `work` | 계획, 현황 대시보드, 편성률 | Bplanm, Bproja, Bbugtm |
| **사업집행 4단계** | `estimate`, `deliberation`, `contract`, `payment` | 소요예산 산정→과업심의→입찰계약→대금지급 (`/api/project/**`, 상태머신) | Bestim·Besttm, Bdelim, Bcontm, Bpaymm·Bpaymt |
| **협의회** | `council` | 타당성검토, 위원선정, 생략판정, 평가, 결과 | Basctm, Baskpm, Bevalm, Bperfm 등 10개 |
| **변경 로그** | `domain/log` | `@LogTarget` 업무 엔티티 자동 감사로그 | BaseLogEntity 하위 *L 엔티티 |
| **파일·AI·EAI** | `infra/file`, `infra/ai`, `infra/eai` | 첨부파일, Gemini API, KDB 표준전문 발송(미연동) | Cfilem |

### 6.2 프론트엔드 주요 모듈 (Nuxt 4 기반)

| 모듈 | 경로 | 설명 |
|------|------|------|
| **인증** | `stores/auth.ts`, `composables/useAuth.ts` | 로그인/로그아웃, 세션 복원 |
| **API 래퍼** | `composables/useApiFetch`, `$apiFetch` (plugin/auth.ts) | GET/POST/PUT/DELETE, 401 처리 |
| **정보화사업** | `composables/useProjects.ts` | 사업 CRUD + 옵션 조회 |
| **사업집행 4단계** | `composables/{useEstimates,useDeliberations,useContracts,usePayments}.ts`, `pages/project/` | 소요예산·과업심의·입찰계약·대금지급 |
| **예산** | `composables/useBudget*.ts`, `pages/budget/` | 예산현황, 편성률, 통합 목록 |
| **전산업무비** | `composables/useCost.ts`, `pages/info/cost/` | 비용 및 단말기 관리 |
| **문서·협의** | `composables/useDocuments.ts`, `stores/review.ts` | 요구사항 정의서, 사전협의 |
| **협의회** | `composables/useCouncil.ts`, `pages/info/council/` | 협의회 프로세스 |
| **결재** | `composables/useApprovals.ts`, `pages/approval/` | 신청/승인/반려 |
| **게시판** | `composables/useBoard*.ts`, `pages/board/` | 게시판 메타, 게시물, 댓글 |
| **관리자** | `composables/useAdminApi.ts`, `pages/admin/` | 공통코드, 사용자, 역할, 조직 |
| **알림** | `composables/useNotifications.ts` | 알림 조회/폴링/읽음 처리 |
| **실시간 로그** | `composables/useRealtimeLogs.ts`, `pages/admin/realtime-logs.vue` | 변경 로그 폴링, 복합 커서 기반 슬라이딩 윈도우 |
| **Tiptap 에디터** | `components/TiptapEditor.vue` | 리치텍스트(표/이미지/다이어그램) |
| **Tiptap 변수** | `composables/useTiptapVariables.ts` | 동적 변수 토큰 삽입·해석 |

---

## 7. 프로젝트별 상세 가이드

**각 디렉토리의 SoT(Single Source of Truth) 파일을 우선 참조하세요.**

### 7.1 백엔드 (Spring Boot 4)
- **[`it_backend/README.md`](./it_backend/README.md)** — 전체 기술 스택, 아키텍처, API 엔드포인트 (38개 컨트롤러)
- **[`it_backend/CLAUDE.md`](./it_backend/CLAUDE.md)** — 기술 결정, 인증 정책 (SoT), 보안 규칙, 환경 설정
- **[`it_backend/docs/guides/data-model.md`](./it_backend/docs/guides/data-model.md)** — 엔티티·테이블 매핑과 채번 규칙

**주요 내용:**
- 인증: JWT httpOnly 쿠키 (15분 Access / 7일 Refresh)
- 아키텍처: Controller → Service → Repository (QueryDSL) → Oracle DB
- 변경 로그: `@LogTarget`과 JPA 리스너 기반 자동 감사
- API 응답: 표준 JSON (success/data/message/meta)
- 폐쇄망 빌드: 외부망에서 수집한 `C:\maven-repo`를 file:// 저장소로 사용
  (→ `it_backend/README.md` §10.1, 변환 스크립트 `it_backend/make-local-maven-repo.ps1`)

### 7.2 프론트엔드 (Nuxt 4)
- **[`it_frontend/README.md`](./it_frontend/README.md)** — 전체 기술 스택, 컴포넌트 구조 (84개), Composable 패턴
- **[`it_frontend/CLAUDE.md`](./it_frontend/CLAUDE.md)** — 기술 결정, API 호출 패턴, 라우트 가드 규칙
- **[`it_frontend/docs/guides/styled-data-table.md`](./it_frontend/docs/guides/styled-data-table.md)** — DataTable 래퍼 사용법

**주요 내용:**
- CSR(SPA) 모드, httpOnly 쿠키 인증
- 이중 API 패턴: `useApiFetch` (GET) vs `$apiFetch` (POST/PUT/DELETE)
- 관리자 접근 제어: 라우트 가드 + DB 메뉴 권한 필터링 + 백엔드 API 보호
- Tiptap 에디터: 표/이미지/다이어그램/수식/변수 토큰 지원

### 7.3 공통 규약
- **[`CLAUDE.md`](./CLAUDE.md)** — 인증 정책 (SoT), 한글 주석 원칙, 문서 운영, 게시판 도메인 규칙
- **[`TASK.md`](./TASK.md)** — 미구현 기능, 기술 부채, 보안 강화, 테스트 확대 과제

---

## 8. Health Stack (빠른 품질 확인)

신규 개발 또는 코드 변경 후 아래 명령어로 품질을 확인합니다.

**각 명령어는 해당 디렉토리에서 실행합니다.**

### 프론트엔드 품질 확인

```bash
cd it_frontend

# TypeScript 타입 체크 (Nuxt 내장)
npm run typecheck

# ESLint + Prettier 린트
npm run lint

# 단위 테스트 (Vitest) — 101개 단위 테스트 + 16개 E2E 테스트
npm test

# 파일 변경 감지 실시간 테스트
npm run test:watch

# 커버리지 리포트 생성
npm run test:coverage
# 리포트: coverage/ 디렉토리
```

### 백엔드 품질 확인

```bash
cd it_backend

# JUnit 5 + Mockito 테스트 실행 — 164개 테스트 파일
./gradlew test

# 커버리지 리포트 생성 (JaCoCo)
./gradlew jacocoTestReport
# 리포트: build/reports/jacoco/test/html/index.html

# 전체 빌드 (테스트 포함)
./gradlew build

# 클린 빌드 (의존성 재다운로드)
./gradlew clean build
```

### 품질 목표

| 항목 | 목표 | 검증 방법 |
|------|------|----------|
| **프론트엔드 커버리지** | 80% 이상 | `npm run test:coverage` |
| **백엔드 커버리지** | 70% 이상 | `./gradlew jacocoTestReport` |
| **타입 안전성** | 0개 오류 | `npm run typecheck` |
| **린트 위반** | 0개 경고 | `npm run lint` |
| **테스트 통과율** | 100% | `npm test` + `./gradlew test` |

---

## 9. AI 하네스 구성

본 프로젝트는 **Superpowers를 기본 워크플로우**로 사용합니다. ECC는 프레임워크별 구현 패턴을 보강하고, gstack은 브라우저 QA·리뷰·배포 확인을 보조합니다.

```
┌─────────────────────────────────────────────────────────────┐
│  Superpowers — 아이디어 구체화, 계획, 실행, TDD, 최종 검증 │
│  ECC         — Spring Boot·Nuxt·테스트·보안 패턴 라이브러리 │
│  gstack      — 브라우저 QA, 조사, 리뷰, 배포 전 점검        │
└─────────────────────────────────────────────────────────────┘
```

### 9.1 올바른 프롬프트 지침

간단한 기능은 프롬프트에서 대화하듯이 진행하면 됩니다.
```
ex1)
> /info/cost 편집모드에서 작성 중 [취소]를 눌렀을 때 [취소 확인] 다이얼로그에서 버튼을 아래와 같이 바꿔줘
 - 기존 : [계속 편집] (파란색) [확인] (파란색)
 - 변경 : [아니오] (파란색) [예] (빨간색)
   
ex2)
> 사이드바 메뉴 [정보기술부문 계획]과 그 하위 메뉴에 components/icons/IconCrown.vue 왕관 아이콘 적용해주고, 관리자 권한(ITPAD001) 보유자만 메뉴가 보이고 접속 가능하도록 해줘 (상단 메뉴 관리자처럼)

ex3) 
> [전산업무비 목록] 편집모드에서 PrevYearCostPickerDialog.vue [전년도 전산업무비 불러오기] 시 아래의 로직이 추가되도록 해줘
 - 최초지급일 : +1년
 - 결재현황 : null
   
ex4)
> [예산 현황] /budget/status 전산업무비 탭에서 [증감] 컬럼은 증가한 경우 +증가액 (붉은색), -감소액 (파란색)으로 표기해줘
```

복잡한 기능은 별도 md 파일로 요구사항(PRD)을 작성하여 지시하고, 항상 문서화 및 TDD(테스트 주도 개발)를 함께 요구합니다. 문서화와 TDD는 `REVIEW.md`, `TEST.md`를 통해 주기적으로 현행화하되, 기능 구현 직후 반영하는 것이 가장 정확합니다.

> [!note] 주의사항
> 서로 관련이 없는 많은 기능을 하나의 md 파일에 정의해서 한번에 계획 및 설계서를 작성하는 것은 아직 권고하지 않습니다. 

 ```
> /write-plan C:\it\TASK.md 이행계획 작성해줘. 이행 후 C:\it\TASK.md 현행화 계획을 포함하고, 동일한 문제가 재발하지 않도록 코딩 컨벤션 등에 반영하여 앞으로 유의해야 할 부분이 있다면 각 프로젝트 폴더 README.md, CLAUDE.md에 반영해줘. TDD 방법론도 적용해줘.

1. /write-plan {기능 요구사항}        ← Superpowers: 계획 수립
2. /execute-plan                    ← Superpowers: 계획 단계별 실행
3. /test-driven-development         ← Superpowers: 테스트 우선 구현
4. /verification-before-completion  ← Superpowers: 완료 전 검증
5. /qa                              ← gstack: 브라우저 테스트
6. /review                          ← gstack: 코드 리뷰
7. /ship                            ← gstack: PR 배포
 ```

[요구사항 구체화] 요구사항이 구체화되지 않았거나 조언이 필요한 경우 /brainstorming으로 시작하는게 좋습니다.
```
> /brainstorming C:\it\TEST.md 활동이 더 agents, team, rule, skill을 종합적으로 활용해서 효과적으로 동작할 수 있도록 개선할 여지가 있는지 확인해줘

1. /brainstorming {기능 아이디어}     ← Superpowers: 기능 구체화
2. /write-plan {기능 요구사항}        ← Superpowers: 실행 계획
3. /execute-plan                    ← Superpowers: 구현 진행
4. /verification-before-completion  ← Superpowers: 완료 전 검증
5. /qa                              ← gstack: 브라우저 테스트
6. /review                          ← gstack: 코드 리뷰
7. /ship                            ← gstack: PR 배포
```

---
## 10. Superpowers — 기본 워크플로우

Superpowers는 개발 방법론 수준의 워크플로우입니다. 모호한 요구사항을 구체화하고, 구현 계획을 만들고, TDD와 완료 전 검증을 강제하는 기본 경로로 사용합니다.

| 스킬 | 용도 | 사용 시점 |
|------|------|-----------|
| `/brainstorming` | 아이디어 구체화·대안 탐색 | 요구사항이 흐릿할 때 |
| `/write-plan` | 구조화된 구현 계획 작성 | 복잡한 기능 착수 전 |
| `/execute-plan` | 작성된 계획 단계별 실행 | 계획 수립 후 |
| `/systematic-debugging` | 체계적 디버깅 | 원인 불명 버그 |
| `/test-driven-development` | RED→GREEN→REFACTOR 강제 | 새 기능·버그픽스 |
| `/verification-before-completion` | 완료 전 최종 검증 | 리뷰·배포 전 |

산출물은 `docs/superpowers/`를 우선 사용합니다. 기능 단위 계획·스펙·검증 노트는 같은 디렉토리에 모아 추적합니다.

---

## 11. ECC — 패턴 스킬 라이브러리

ECC는 프레임워크별 Best Practice 스킬 모음입니다. Superpowers로 방향을 잡은 뒤, 구현 세부 패턴이 필요할 때 보조로 사용합니다.

### 11.1 백엔드 (Spring Boot)

```bash
/springboot-patterns       # 레이어드 아키텍처, JPA, 예외처리 패턴
/springboot-tdd            # Spring Boot TDD 워크플로우
/springboot-verification   # 구현 완료 후 검증 체크리스트
/backend-patterns          # API 설계, 페이지네이션, 캐싱
/api-design                # REST API 설계 원칙
```

### 11.2 프론트엔드 (Nuxt 4)

```bash
/frontend-design           # UI/UX 컴포넌트 설계 원칙
/frontend-patterns         # Vue 3 Composition API 패턴
/e2e-testing               # Playwright E2E 테스트 패턴
```

### 11.3 품질·보안

```bash
/tdd-workflow              # TDD 실천 워크플로우
/security-review           # OWASP Top 10, 보안 취약점 스캔
/plankton-code-quality     # 코드 품질 종합 분석
```

---

## 12. gstack — 브라우저 기반 운영 명령어

gstack은 두 서버가 모두 기동된 상태에서 브라우저 기반 QA와 릴리즈 전 점검을 수행할 때 사용합니다.

```bash
# 서버 기동 (각각 별도 터미널)
cd it_backend  && ./gradlew bootRun
cd it_frontend && npm run dev
```

### 12.1 핵심 명령어

| 명령어 | 용도 | 사용 시점 |
|--------|------|-----------|
| `/qa` | 브라우저 자동화 품질 테스트 | 기능 구현 완료 후 |
| `/investigate` | 버그·500 오류 원인 분석 | 에러 발생 시 |
| `/review` | git diff 기준 코드 리뷰 | 커밋 전 |
| `/ship` | PR 생성 및 배포 | 배포 준비 완료 시 |
| `/health` | 코드 품질 전반 점검 | 주기적 품질 관리 |
| `/checkpoint` | 작업 상태 저장·복원 | 긴 작업 중간 저장 |

### 12.2 핵심 테스트 시나리오 (`/qa`)

- 테스트 결과 파일 위치: `it\.gstack\qa-reports`

---
## 13. IT Portal 에이전트 팀

에이전트는 `~/.claude/agents/`에 설치된 ECC 전문가 에이전트입니다.  
Claude가 상황에 따라 자동으로 활성화하거나, 요청 시 서브에이전트로 직접 호출합니다.

### 13.1 백엔드 (Spring Boot 4 · Java 25 · Oracle · JPA/QueryDSL)

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `java-reviewer` | 레이어드 아키텍처·JPA 패턴·트랜잭션·동시성 리뷰 | Controller/Service/Repository 수정 후 |
| `java-build-resolver` | Gradle 빌드·컴파일·의존성 에러 수정 | `./gradlew build` 실패 시 |
| `database-reviewer` | JPA 엔티티·QueryDSL 쿼리·N+1·인덱스 설계 리뷰 | 쿼리·스키마 변경 시 |
| `security-reviewer` | JWT·Spring Security·RBAC·OWASP Top 10 취약점 스캔 | 인증/인가 코드 변경 전 커밋 |

### 13.2 프론트엔드 (Nuxt 4 · TypeScript · Vue 3 · PrimeVue · Pinia)

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `typescript-reviewer` | 타입 안전성·`useApiFetch`·`$apiFetch` 패턴·Composable 구조 리뷰 | `.vue`·`.ts` 수정 후 |
| `e2e-runner` | Playwright 기반 E2E 시나리오 생성·실행·유지 | 화면 기능 구현 완료 후 |
| `build-error-resolver` | TypeScript·Nuxt 빌드 오류 수정 | `npx nuxt typecheck` 실패 시 |

### 13.3 품질 · 보안

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `code-reviewer` | 풀스택 코드 품질·가독성·패턴 리뷰 | 모든 코드 변경 후 (자동 활성화) |
| `silent-failure-hunter` | 에러 삼킴·빈 catch·누락된 에러 전파 탐지 | 서비스·컨트롤러 신규 작성 시 |
| `pr-test-analyzer` | PR 테스트 커버리지·행동 커버리지 평가 | PR 생성 전 |
| `tdd-guide` | 테스트 먼저 작성(RED→GREEN→IMPROVE) 워크플로우 강제 | 새 기능·버그픽스 착수 시 |

### 13.4 계획 · 설계

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `planner` | 구현 청사진·파일·인터페이스·빌드 순서 설계 | 복잡한 기능 착수 전 |
| `code-architect` | 기존 패턴 분석 기반 기능 아키텍처 설계 | 신규 도메인 추가 시 |
| `architect` | 시스템 확장성·기술 결정 분석 | 아키텍처 변경 검토 시 |
| `performance-optimizer` | 쿼리·번들·렌더링 병목 분석·최적화 | 성능 이슈 발생 시 |

### 13.5 문서 · 유지보수

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `doc-updater` | CLAUDE.md·README·가이드 문서 동기화 | 코드 구조 변경 후 |
| `refactor-cleaner` | 미사용 코드·중복·dead import 정리 | 주기적 코드 정비 시 |
| `code-simplifier` | 최근 변경 코드 간결화·일관성 개선 | 기능 구현 완료 직후 |

---

## 14. 워크플로우 가이드

### 14.1 새 기능 개발 (풀스택)

**필수 단계** — 매 기능마다 실행:
```
1. /brainstorming {기능 아이디어}     ← Superpowers: 기능 구체화
2. /write-plan {기능 요구사항}        ← Superpowers: 계획 수립
3. /execute-plan                    ← Superpowers: 구현 단계 진입
4. /test-driven-development         ← Superpowers: 테스트 우선 구현
5. /verification-before-completion  ← Superpowers: 완료 전 검증
6. /qa                              ← gstack: 브라우저 테스트
7. /review                          ← gstack: 코드 리뷰
8. /ship                            ← gstack: PR 배포
```

**선택 단계** — 필요한 경우에만 실행:
```
/springboot-patterns    ← 신규 도메인 착수 시 Spring Boot 컨벤션 확인
/frontend-patterns      ← 신규 프론트 기능 착수 시 Vue/Nuxt 컨벤션 확인
/tdd-workflow           ← TDD를 엄격히 강제하고 싶을 때 (평소엔 "테스트도 작성해줘"로 충분)
```

### 14.2 버그 수정

```
1. /investigate                     ← gstack: 원인 분석
2. /systematic-debugging            ← Superpowers: 체계적 디버깅
3. /test-driven-development         ← Superpowers: 테스트 먼저 작성
4. /qa                              ← gstack: 회귀 테스트
```

### 14.3 코드 품질 점검

```
1. /health                          ← gstack: 전반적 품질
2. /security-review                 ← ECC: 보안 취약점
3. /plankton-code-quality           ← ECC: 코드 품질 분석
```

### 14.4 정기 정비

| 작업 | 시작 방법 |
|------|-----------|
| 전체 코드·구조 정비 | `REVIEW.md 진행해줘` |
| 테스트 코드 작성 | `TEST.md 진행해줘` |
| 코드 간결화 | `/simplify 하위 디렉토리 포함` |

---

## 15. 추가 핵심 도메인 및 모듈 관계 (상세)

### 15.1 백엔드 주요 도메인 (Spring Boot)

| 도메인 | 모듈 | 설명 |
|--------|------|------|
| **인증·보안** | `common/system` | JWT httpOnly 쿠키, 로그인 이력, Brute-force 보호 |
| **사용자·조직** | `common/iam` | RBAC, 자격등급, 역할 매핑 |
| **신청서·결재** | `common/approval` | 전자결재 프로세스, 상태 전이 |
| **공통 게시판** | `common/board` | 게시판 메타, 게시물, 댓글, 권한 검증 |
| **공통코드** | `common/code` | 코드 CRUD, 캐싱 |
| **실시간 로그** | `common/admin/realtime` | `V_ITPAPP_LOG_FEED` 기반 관리자 전용 변경 로그 스냅샷 |
| **알림** | `common/notification` | 결재/멘션/시스템 알림, Soft Delete, `@TransactionalEventListener` + `REQUIRES_NEW` 패턴 |
| **Tiptap 변수** | `common/system/tiptap` | 에디터 동적 변수 삽입, 카탈로그 조회, 토큰 해석 |
| **정보화사업** | `budget/project` | 사업 CRUD, 복합키 (`prjYy` + `prjSn`) |
| **전산업무비** | `budget/cost` | 비용 항목, 단말기, 복합키 (`costYy` + `costSn`) |
| **요구사항·검토** | `budget/document` | 가이드 문서, 요구사항 정의서, 검토의견 |
| **정보기술부문 계획** | `budget/plan` | 계획 CRUD, JSON 스냅샷 |
| **협의회** | `council` | 신청, 타당성검토, 위원선정, 일정, 평가, 결과 (34개 매핑) |
| **감사로그** | `domain/log` | 자동 변경 로그 (23개 도메인 추적) |
| **파일·AI** | `infra/` | 첨부파일, Gemini API |

### 15.2 프론트엔드 주요 모듈 (Nuxt 4)

| 모듈 | 파일 | 설명 |
|------|------|------|
| **인증** | `stores/auth.ts`, `composables/useAuth.ts` | 로그인, 로그아웃, 세션 복원 |
| **API 래퍼** | `composables/useApiFetch`, `$apiFetch` | GET/POST/PUT/DELETE 요청, 401 처리 |
| **정보화사업** | `composables/useProjects.ts`, `pages/info/projects/` | 사업 CRUD 및 목록/상세/폼 페이지 |
| **예산 관리** | `composables/useBudget*.ts`, `pages/budget/` | 예산현황, 예산작업, 예산 통합 목록 |
| **전산업무비** | `composables/useCost.ts`, `pages/info/cost/` | 비용 및 단말기 관리 |
| **요구사항·사전협의** | `stores/review.ts`, `composables/useDocuments.ts` | 문서 CRUD, 인라인 코멘트 (Tiptap Mark) |
| **협의회** | `composables/useCouncil.ts`, `pages/info/council/` | 협의회 프로세스 관리 |
| **결재** | `composables/useApprovals.ts`, `pages/approval/` | 신청 목록, 상세, 처리 |
| **알림** | `composables/useNotifications.ts` | 알림 목록/읽음/삭제, 60초 폴링 (폴링 오류 의도적 삼킴) |
| **실시간 로그** | `composables/useRealtimeLogs.ts`, `pages/admin/realtime-logs.vue` | 관리자 변경 로그 폴링, 복합 커서 기반 슬라이딩 윈도우 |
| **Tiptap 에디터** | `components/TiptapEditor.vue` | 리치 텍스트, 표, 이미지, 다이어그램, 수식 |
| **Tiptap 변수** | `composables/useTiptapVariables.ts` | 에디터 변수 토큰 추출·카탈로그 조회·해석 |
| **공통 게시판** | `composables/useBoard*.ts`, `pages/board/` | 게시판 메타, 게시물, 댓글 CRUD |
| **시스템 관리** | `pages/admin/`, `composables/useAdminApi.ts` | 공통코드, 사용자, 역할, 조직, 파일 관리 |

---

## 16. 인증 및 보안 (정책 상세)

### 16.1 JWT httpOnly 쿠키 인증

**로그인 흐름:**
1. 사번/비밀번호 제출 → `POST /api/auth/login`
2. 백엔드가 Access Token(15분) + Refresh Token(7일) 발급
3. `Set-Cookie` 헤더로 httpOnly 쿠키에 저장 (JavaScript 접근 불가)
4. 프론트엔드 `it-portal-user` 쿠키에 사용자 정보 저장 (UX용)

**API 요청:**
- 모든 인증 API는 `credentials: 'include'`로 쿠키 자동 전송
- `401 Unauthorized` 시 `refresh()` → 새 토큰 → 원요청 재시도

**주의:** 프론트엔드가 JWT 문자열을 직접 저장/읽지 않음 (XSS 방어)

### 16.2 관리자 접근 제어 (RBAC)

| 계층 | 기술 | 예시 |
|------|------|------|
| 클라이언트 | 라우트 가드 + Pinia | `middleware/admin.ts`, `user.value?.athIds?.includes(ROLE.ADMIN)` |
| 백엔드 URL | SecurityConfig | `/api/admin/**` URL 패턴 → `ROLE_ADMIN` 필수 |
| 백엔드 메서드 | @PreAuthorize | `@PreAuthorize("hasRole('ADMIN')")` 컨트롤러 클래스/메서드 |

---

## 17. 기타 프로젝트 스킬

| 스킬 | 용도 |
|------|------|
| `/fp` | 정통법 기능점수(FP) 산정 |

---

## 18. 주요 파일 및 참조

| 항목 | 파일 | 용도 |
|------|------|------|
| **모노레포 규약** | `CLAUDE.md` | 인증 정책 (SoT), 한글 주석 원칙, 공통 게시판 도메인 규칙 |
| **백엔드 가이드** | `it_backend/CLAUDE.md` | 기술 스택, 아키텍처, API 엔드포인트, 보안 정책, 환경 설정 |
| **프론트엔드 가이드** | `it_frontend/CLAUDE.md` | 기술 스택, 라우팅, Tiptap 통합, API 패턴, 테스트 전략 |
| **기술 부채** | `TASK.md` | 미구현 기능, 보안 강화, 성능 최적화, TDD 확대 |
| **테스트 로드맵** | `TEST.md` | 단위/통합/E2E 테스트 계획, 커버리지 목표 |
| **리뷰 체크리스트** | `REVIEW.md` | 코드 리뷰 기준, 에이전트 병렬 분석 |
| **에이전트 설정** | `AGENTS.md` | AI 에이전트 커스텀 설정 |

---

## 19. 개발 노트: 현재 코드베이스 구조

### 19.1 백엔드 모듈 관계

백엔드는 Spring Boot 4 기반 레이어드 구조입니다. `controller → service → repository → Oracle DB` 흐름을 유지하며, 복잡한 조회는 QueryDSL `RepositoryCustom`/`RepositoryImpl` 패턴으로 분리합니다.

| 영역 | 역할 | 주요 특징 |
|------|------|-----------|
| `common/system` | 인증, JWT, 로그인 이력 | httpOnly 쿠키 기반 Access/Refresh Token, `JwtAuthenticationFilter`에서 쿠키 우선 인증 |
| `common/iam` | 사용자, 조직, 자격등급 | `CuserI`, `CorgnI`, `CauthI`, `CroleI` 중심의 RBAC 기반 데이터 |
| `common/approval` | 전자결재 | 신청서 마스터와 원본 업무 객체 연결, 결재 완료 이벤트 발행 |
| `common/board` | 공통 게시판 | 게시판 메타, 게시물, 댓글, 답변글, 권한/부서 제한 정책 |
| `domain/menu` | DB 기반 메뉴 | `Cmenum`/`Cmenua`/`Cmenud` 기준 메뉴 트리, 역할 필터링, DYN 게시판 메뉴 |
| `domain/budget` | 정보화 예산/사업 | project, cost, plan, work, status, document 하위 도메인으로 분리 |
| `domain/council` | 정보화실무협의회 | 심의과제, 평가위원, 타당성, 결과서, 일정 관리 |
| `domain/log` | 감사 로그 | JPA 엔티티 리스너 기반 변경 로그 인프라 |
| `infra/file`, `infra/ai` | 파일, Gemini 연동 | 업무 도메인과 분리된 외부 연동 계층 |

### 19.2 프론트엔드 모듈 관계

프론트엔드는 Nuxt 4의 `app/` 소스 루트를 사용합니다. 페이지는 업무 메뉴 구조를 따르고, 반복 API 호출은 `composables/`, 전역 인증/검토 상태는 `stores/`에서 관리합니다.

| 영역 | 역할 | 주요 특징 |
|------|------|-----------|
| `app/pages` | 라우트 화면 | admin, info, budget, approval, audit 등 업무 메뉴별 화면 |
| `app/components` | UI 조립 단위 | PrimeVue 기반 공통 테이블, 결재/사전협의/협의회 컴포넌트 |
| `app/composables` | API 및 화면 로직 | `useApiFetch`는 GET 조회, `$apiFetch`는 변경 요청에 사용. `useMenu`는 서버 필터링 메뉴 트리의 단일 소스 |
| `app/stores` | 전역 상태 | 인증 상태와 사전협의 세션 상태 관리 |
| `app/types` | 공유 타입 | 인증/RBAC, 예산작업, 협의회, 사전협의 타입 |
| `app/utils` | 순수 유틸 | 금액/상태 표시, Excel/HWPX/PDF 생성 보조 |

### 19.3 핵심 설계 결정

- 인증은 httpOnly 쿠키 방식입니다. 프론트엔드가 JWT 문자열을 직접 다루지 않고, 브라우저가 쿠키를 자동 전송합니다.
- Access Token의 기본 유효시간은 15분입니다. 백엔드 JWT 설정과 쿠키 Max-Age를 같은 시간으로 유지해야 합니다.
- 관리자 접근 제어는 프론트 라우트 가드와 백엔드 URL/메서드 권한 검사를 함께 사용합니다.
- 사이드바와 Breadcrumb 메뉴는 `GET /api/menus` 응답을 `useMenu`가 역인덱싱해 사용합니다. 프론트 메뉴 숨김은 UX 보조이며 권한 필터링의 SoT는 `MenuQueryService`와 백엔드 API 권한입니다.
- `StyledDataTable`은 PrimeVue DataTable 스타일 차이를 흡수하는 표준 래퍼입니다. 신규 목록 화면은 이 컴포넌트를 우선 사용합니다.
- 사전협의 검토 세션은 일부 UI 상태가 아직 메모리/모의 데이터에 의존합니다. 서버 영속화와 프로젝트별 검토자 조회는 `TASK.md`의 후속 과제로 관리합니다.
- 공통 게시판은 `/board/**` 사용자 화면과 `/admin/boards` 관리자 화면으로 구성됩니다. 프론트 메뉴 필터는 UX 보조이며, 최종 권한은 백엔드 게시판 서비스에서 검증합니다.

### 19.16 2026-07-06 REVIEW 델타 현행화

- 실제 파일 수 기준으로 백엔드 377개 메인 Java 파일, 164개 테스트 파일, 84개 JPA 엔티티, 42개 컨트롤러와 프론트엔드 84개 컴포넌트, 62개 composable/helper, 67개 페이지를 확인했습니다.
- 프론트엔드에 추가된 `useDocumentStatusApi`, `useIoeCategoryOptions`, `ioeCategoryHelpers`, `useYnOptions`, `costListPageHelpers`를 문서에 반영했습니다.
- 빈 `catch {}` 패턴은 백엔드/프론트 소스에서 추가 발견되지 않았고, 기존 TASK.md의 에러 처리 후속 과제는 유지합니다.

### 19.15 2026-06-24 REVIEW 현행화

- `REVIEW.md` 기준으로 백엔드/프론트/실패 삼킴 경로를 재점검했습니다.
- 실제 파일 수 기준으로 백엔드 357개 메인 Java 파일, 135개 테스트 파일, 77개 JPA 엔티티, 38개 컨트롤러, 프론트 83개 컴포넌트, 58개 composable, 67개 페이지, 116개 TypeScript 테스트 파일로 통계를 정정했습니다.
- 사업집행 4단계의 `bbrC` 부서 필터는 `EstimateRepositoryImpl`만 실제 쿼리 조건을 적용하고, `Contract`/`Deliberation`/`PaymentRepositoryImpl`은 대상 2종 조인 고도화 전까지 미적용 상태임을 TASK.md 추적 대상으로 유지합니다.
- 프론트 API 래퍼는 `runtimeConfig.public.apiBase` 기반 절대 URL과 `useApiFetch`/`$apiFetch` 분리 패턴을 유지합니다. `useTiptapTableTools`의 빈 catch 후보는 저장 영향 평가가 필요한 후속 에러 처리 과제로 등록했습니다.

### 19.14 2026-06-22 AI 하네스 및 문서 현행화

- 루트 README의 AI 하네스 기준을 Superpowers 중심으로 정리했습니다. `/brainstorming`, `/write-plan`, `/execute-plan`, `/test-driven-development`, `/verification-before-completion`을 기본 흐름으로 사용합니다.
- ECC는 Spring Boot/Nuxt/테스트/보안 패턴 보조, gstack은 브라우저 QA·리뷰·배포 전 점검 보조로 정리했습니다.
- 실제 파일 수 기준으로 백엔드 353개 메인 Java 파일, 121개 테스트 파일, 74개 JPA 엔티티, 프론트 83개 컴포넌트, 58개 composable, 67개 페이지로 통계를 정정했습니다.

### 18.9 2026-05-19 REVIEW 재점검

- Java/TypeScript 주석 재점검 결과를 반영했습니다. 깨진 한글 주석, 잘못 배치된 JavaDoc, 게시판 QueryDSL 조회 의도 주석을 정리했습니다.
- 프론트 관리자 미들웨어는 `/admin/**`뿐 아니라 관리자 권한이 필요한 업무 라우트에도 적용될 수 있음을 `it_frontend/CLAUDE.md`에 반영했습니다.
- 2026-05-19 `npm run typecheck` 실패 후보(`useCouncilCodes.ts` 코드명 필드, 전산업무비 지급주기 prop 이름 불일치)는 비즈니스 로직 수정 범위에서 제외하고 `TASK.md`에 후속 과제로 등록했습니다.

### 18.8 2026-05-16 루트 README 현행화

- 모노레포 디렉토리 구조 추가 (it_frontend, it_backend, it_database, docs/)
- 로컬 시작 명령어 추가 (npm run dev, ./gradlew bootRun, connect-db.ps1)
- Health Stack 명령어 명확화 (typecheck, lint, test, coverage)
- 개발/운영 환경 URL 테이블 추가
- 프로젝트별 상세 문서 cross-link (CLAUDE.md, README.md)
- 핵심 도메인 및 모듈 관계 추가 (도메인 14개, API 래퍼 12개)
- 인증 및 보안 섹션 추가 (JWT httpOnly, RBAC)
- 주요 파일 참조 테이블 추가

### 12.8 2026-05-14 정비 메모

- 공통 게시판(`common/board`, `/board`, `/admin/boards`)을 루트/하위 README와 CLAUDE에 반영했습니다.
- 로그인 Brute-force 보호 설명을 실제 구현에 맞게 수정했습니다. 현재는 인메모리 카운터가 아니라 `TPRMPP_CLOGNH` 로그인 실패 이력을 집계합니다.
- 프론트엔드 실제 구조를 컴포넌트 66개, composable 45개, 페이지 52개, 미들웨어 4개 기준으로 갱신했습니다.
- `useDeptFilter`는 실제 파일이 없어 규칙에서 현황/백로그 과제로 조정했습니다.
- Java/TypeScript 일부 주석 불일치와 누락을 보강하고, 전수 보강·lint 복구·게시판 확장 과제는 `TASK.md`에 유지했습니다.

### 12.4 2026-04-29 정비 메모

- 실제 소스 기준으로 백엔드 194개, 프론트엔드 앱 146개 내외의 Java/TypeScript/Vue 파일을 점검했습니다.
- 인증 주석 중 Authorization 헤더/localStorage 중심으로 남아 있던 설명을 httpOnly 쿠키 방식에 맞게 수정했습니다.
- Access Token 쿠키 만료 시간을 JWT 설정의 15분과 맞추고, `CookieUtilTest`로 회귀 검증을 추가했습니다.
- 루트 `TASK.md`가 없어 신규 백로그 파일을 생성했습니다.

### 12.6 2026-05-09 정비 메모

- REVIEW.md 전면 실행: java-reviewer·typescript-reviewer·silent-failure-hunter·security-reviewer·refactor-cleaner·database-reviewer 총 6개 에이전트 병렬 분석.
- **주석 정비**: Java 30개 파일·TypeScript/Vue 40개 파일 오류 주석 교정·누락 JavaDoc/TSDoc 추가, 에러 삼킴 30개 위치에 TODO/FIXME 한글 주석 삽입.
- **보안 이슈 발굴**: `application.properties` 비밀값 기본값 하드코딩(Critical), RBAC 미적용 컨트롤러 다수(High), 파일 업로드 확장자 미검증(High), Brute-force 보호 없음(High) — `it_backend/CLAUDE.md §5.6`에 반영, `TASK.md`에 등록.
- **DB/JPA 이슈**: `BudgetWorkService` N+1 3건, `Bprojm.update()` 35+ 파라미터, `ProjectRepositoryImpl`/`CostRepositoryImpl` 전체 컬럼 SELECT 등 — `TASK.md`에 등록. `CAPPLA`/`BITEMM` 인덱스는 2026-05-10 마이그레이션으로 추가됨.
- **프론트엔드 리팩토링**: `ApplicationViewerDialog` 빈 쉘, `formatDateTime` 3벌 불일치 구현, `alert()` UX 불일치 등 — `TASK.md`에 등록.
- `it_backend/README.md`·`it_frontend/README.md` 전면 재작성 (설계 결정 이유, API 맵, 보안 흐름, 환경 설정 포함).

### 12.7 2026-05-10 정비 메모

- 실제 실행 설정 기준으로 로컬 개발 URL을 프론트엔드 `http://localhost:3000`, 백엔드 `http://localhost:28080`로 정정했습니다.
- `EnvironmentValidator`는 `spring.datasource.password`, `jwt.secret`의 해석 결과가 빈값일 때만 기동을 차단합니다. 현재 `application.properties`에는 `DB_PASSWORD`, `JWT_SECRET` 기본값이 남아 있어 기본값 제거 과제를 `TASK.md`에 다시 열어두었습니다.
- `FileValidator`, `LoginAttemptService`, `GeminiController` 관리자 제한은 코드에 반영된 상태로 확인했습니다. `FileOwnershipChecker`는 단건 삭제에는 적용되어 있으나 다운로드·미리보기·조회·메타수정·원본 기준 일괄삭제 경로는 후속 검증 과제로 남아 있습니다.
- 프론트엔드 `ReviewVersionHistory.vue`의 로컬 `formatDateTime`은 버전 이력 전용 축약 포맷으로 주석을 명확히 했고, 전체 화면 표준 포맷은 `utils/common.ts` 사용 규칙을 유지합니다.

### 12.5 2026-05-06 정비 메모

- 실제 운영 소스 기준으로 Java 199개, TypeScript 61개, Vue 113개를 다시 스캔했습니다.
- 백엔드 인증 설정 문서의 JWT 키명을 실제 `application.properties`의 `jwt.access-token-validity`, `jwt.refresh-token-validity`와 맞췄습니다.
- 프론트엔드 인증 규칙을 재확인했습니다. 토큰은 여전히 httpOnly 쿠키로만 전달하며, `localStorage`는 컬럼 표시 설정과 구버전 사용자 쿠키 마이그레이션에만 사용됩니다.
- 사전협의 코멘트 흐름은 `ReviewCommentController`/`ReviewCommentService`가 `BRIVGM` 조회·생성·해결을 담당하고, 프론트 `useReviewCommentApi`가 UI 타입으로 변환합니다.
- 사전협의 검토자 목록, 작성자 팀명, 첨부파일 매핑은 아직 후속 구현 대상입니다. 관련 항목은 루트 `TASK.md`에서 추적합니다.
- 개발용 `application.properties`에 Oracle 비밀번호와 JWT 시크릿 기본값이 남아 있습니다. 운영 배포 전 환경변수 또는 비공개 프로파일 분리가 필요합니다.

### 18.10 2026-05-22 REVIEW 재점검

- **알림 시스템(`common/notification`)** 신규 추가 확인: `NotificationService`(`REQUIRES_NEW` + `saveAndFlush()` 패턴), `NotificationController`(5개 API), `StubNotificationDispatcher`. 도메인 테이블(§14.1), 프론트 모듈 테이블(§14.2)에 반영했습니다.
- **Tiptap 변수 시스템(`common/system/tiptap`)** 신규 추가 확인: `TiptapVariableService`, `TiptapTokenParser`, `TiptapVariableController`(`GET /api/tiptap-variables/metadata`, `POST /api/tiptap-variables/resolve`). 도메인 및 모듈 테이블에 반영했습니다.
- **소스코드 주석 보강**: java-reviewer·typescript-reviewer·silent-failure-hunter·comment-analyzer 4개 에이전트 병렬 분석. `ApplicationController`·`ProjectController`·`PlanController`에 `@Valid` 누락 FIXME 삽입, `PlanService`에 `@Transactional(readOnly=true)` 누락 TODO, `CouncilService`에 유니코드 이스케이프 교체 TODO, `stores/review.ts`에 빈 catch 블록 [HIGH] TODO 3건, `budget/report.vue`에 FIXME 1건, `useNotifications.ts`에 폴링 정책 주석 보강.
- **컴포넌트·Composable 카운트 갱신**: components 67→72개, composables 45→48개.
- `it_backend/README.md` — 알림 시스템·Tiptap 변수 시스템 섹션(§5.0, §5.0.1) 추가.
- `it_frontend/README.md` — `useNotifications.ts`(§4.9), `useTiptapVariables.ts`(§4.10), `stores/review.ts` 알려진 한계(§4.11) 추가.

### 18.11 2026-06-01 REVIEW 재점검

- **실시간 로그 모니터링** 확인: 백엔드 `common/admin/realtime`(`RealtimeLogController`/`Service`/`Repository`)와 프론트 `pages/admin/realtime-logs.vue`, `useRealtimeLogs.ts`, `components/admin/realtime/` 구조를 루트/하위 README와 CLAUDE에 반영했습니다.
- **소스 통계 갱신**: 백엔드 271개 메인 Java 파일, 92개 테스트 파일, 63개 JPA 엔티티, 프론트 components 83개, composables 50개, pages 56개 기준으로 현행화했습니다.
- **주석 보강**: `CouncilService`, `info/plan/[id].vue`, `budget/status.vue`의 무시형 실패 경로에 한글 TODO를 추가했습니다.
- **백로그 갱신**: 2026-06-01 기준 typecheck/lint 실패, 실시간 로그 검증, N+1/인덱스 후보를 `TASK.md`에 반영했습니다.

### 18.12 2026-06-05 REVIEW 재점검

- **DB 기반 메뉴 구조 확인**: 백엔드 `domain/menu`(`MenuQueryService`, `AdminMenuService`)와 프론트 `useMenu`를 확인해 서버 권한 필터링 메뉴 트리와 Breadcrumb 역인덱스 구조를 문서에 반영했습니다.
- **소스 통계 갱신**: 백엔드 291개 메인 Java 파일, 96개 테스트 파일, 63개 JPA 엔티티, 32개 컨트롤러, 프론트 components 84개, composables 52개, pages 58개 기준으로 현행화했습니다.
- **주석 보강**: `MenuQueryController`, `MenuQueryService`, `AdminMenuService`, `useMenu`의 공개 계약과 DYN 메뉴 처리 주석을 한글로 보강했습니다.

### 18.13 2026-06-09 REVIEW 재점검

- **정보화사업 집행 4단계 신규 반영**: 백엔드 `domain/{estimate,deliberation,contract,payment}`(소요예산 산정→과업심의→입찰계약→대금지급, `/api/project/**`, 상태머신 41~79)와 `infra/eai`(KDB 표준전문 발송, sealed EaiPayload SPI, eai.enabled=false 미연동), 프론트 `pages/project/**` + composable 4종(`useEstimates`/`useDeliberations`/`useContracts`/`usePayments`)을 루트/하위 README·CLAUDE에 반영했습니다.
- **소스 통계 갱신**: 백엔드 350개 메인 Java 파일, 115개 테스트 파일, 79개 JPA 엔티티, 36개 컨트롤러, 감사로그 대상 31개, 프론트 components 84개, composables 56개, pages 67개 기준으로 현행화했습니다.
- **보안 점검(Task 3)**: 집행 4단계 서비스 소유권 검증 누락(HIGH), `Contract/Deliberation/PaymentRepositoryImpl` bbrC 부서필터 미적용(HIGH), DTO 금액 검증·EAI 운영검증/로그 마스킹 등을 `TASK.md` 보안 섹션에 등록하고 백엔드 CLAUDE.md §5.18에 집행 4단계 보안 규칙을 명문화했습니다.
- **백로그 갱신(Task 4)**: 집행 4단계 시퀀스 NOCACHE·복합 인덱스(DEL_YN/정렬)·상세 N+1·BPAYTM 인덱스 등 DB 과제를 `TASK.md` DB/JPA 섹션에 추가했습니다. 신규 도메인 코드는 한글 주석이 충실하여 `PaymentController` 클래스 주석 1건만 보강했습니다.

### 18.14 2026-07-01 REVIEW 재점검

- 정보보호시스템 정실협은 `ROLE.INFOSEC_ADMIN`과 `council-manager` 미들웨어로 일반 IT 관리자와 화면 접근 범위를 분리하며, 타당성검토부터 결재·생략판정·개최준비·평가·결과까지 이어지는 흐름을 백엔드와 프론트엔드 README에 반영했습니다.
- 백엔드 캐시는 Caffeine 기반 캐시별 TTL·최대 크기와 트랜잭션 인지 프록시를 사용하며, 사업 생성·수정 시 Tiptap 사업 카탈로그 캐시를 무효화합니다.
- 사업집행 4단계의 `bbrC` 검색은 사업과 전산업무비를 각각 LEFT JOIN하여 주관부서를 필터링하는 현재 구현으로 문서를 교정했습니다.
- 당시 소스 기준으로 백엔드 375개 메인 Java 파일, 152개 테스트 파일, 80개 JPA 엔티티, 38개 컨트롤러와 프론트엔드 84개 컴포넌트, 60개 composable, 67개 페이지를 확인했습니다.
