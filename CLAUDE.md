---
[ 프로젝트 메인 가이드 ]
본 파일은 IT Project Portal의 진입점입니다. 공통 운영 규약과 각 하위 프로젝트(`it_backend`, `it_frontend`)의 CLAUDE.md 포인터를 정의합니다.
AI 어시스턴트는 코드 생성 시 모든 주석을 한글로 작성합니다.
---

## 1. 프로젝트 개요

- 명칭 : IT Project Portal (IT 정보화 포탈)
- 주요 기능: 정보화 예산, 사업, 인력 관리, 관리자 실시간 로그 모니터링

## 2. 디렉토리 구조 및 SoT 분배

```
it/
├── it_frontend/        ← Nuxt 4 (UI). 상세는 it_frontend/CLAUDE.md
├── it_backend/         ← Spring Boot (API). 상세는 it_backend/CLAUDE.md
├── it_database/        ← DDL/시드/마이그레이션
├── docs/               ← 문서, 리포트, Superpowers 산출물
└── TASK.md             ← 미구현/기술부채/장기 과제
```

### 4-repo 토폴로지

`C:\it`는 문서·도구만 추적하고 `it_frontend`/`it_backend`/`it_database`는 각각 독립 원격 저장소입니다(루트 `.gitignore`로 제외). 호환 커밋 조합은 `versions.lock`에 기록하며 `scripts/update-versions-lock.ps1`로 갱신합니다. 교차 저장소 변경은 백엔드 계약(API) 커밋을 먼저 만들고, 이를 참조하는 프론트 커밋을 뒤이어 만듭니다.

### 커밋 스테이징 규칙

네 저장소의 워킹트리를 여러 작업이 동시에 공유하므로, 커밋 시점에 **내 작업과 무관한 변경이 함께 올라와 있는 것이 정상 상태**입니다.

- `git add`는 **경로를 명시**합니다. `git add -A`, `git add .`, `git commit -a`를 쓰지 않습니다.
- 한 파일에 내 변경과 남의 변경이 섞였으면 `git add -p`(또는 `git diff` → `git apply --cached`)로 **내 hunk만** 스테이징합니다.
- 커밋 직전 `git diff --cached --stat`으로 스테이징 목록이 의도한 경로와 정확히 일치하는지 확인합니다.
- 브랜치를 바꾸기 전 현재 브랜치를 확인합니다. 다른 작업이 워킹트리의 브랜치를 전환해 둘 수 있으므로, `git commit` 결과의 브랜치명을 그대로 신뢰하지 말고 `git rev-parse --abbrev-ref HEAD`로 확인합니다.
- 이 규칙을 어겨 무관한 커밋에 변경이 섞여 들어갔고 이미 푸시되어 후속 작업이 쌓였다면, 이력을 재작성하지 말고 `TASK_DONE.md`에 커밋 대응표를 남깁니다(선례: 2026-08-16 담당자 이름 표시 보정).

각 영역의 단일 진실 공급원(Single Source of Truth):

| 토픽                                                                | SoT                                                                                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 백엔드 기술 스택 / API 설계 / 엔티티 / 인증 정책 / 운영 비밀값 기준 | `it_backend/CLAUDE.md`                                                                                                            |
| 프론트엔드 기술 스택 / 컴포넌트 / 라우팅 / 클라이언트 인증 책임     | `it_frontend/CLAUDE.md`                                                                                                           |
| 데이터 모델                                                         | 물리 구조=`it_database/migrations/`, ORM 매핑=`it_backend` 엔티티, 조회 인덱스=`it_backend/docs/guides/persistence/data-model.md` |
| 컴포넌트 가이드 (StyledDataTable 등)                                | `it_frontend/docs/guides/`                                                                                                        |
| 공통 게시판 도메인 규칙                                             | `it_backend/CLAUDE.md`, `it_frontend/CLAUDE.md`                                                                                   |
| 엔티티, 컬럼명 명명 규칙 (메타용어사전)                             | `C:\it\meta\meta.txt`                                                                                                             |
| 다국어 (화면 문구, 언어 추가)                                       | 프론트=`it_frontend/CLAUDE.md` §6 + `it_frontend/docs/guides/i18n/`, 백엔드 계약·번역 저장=`it_backend/CLAUDE.md` §9              |

## 3.1 개발 환경

| 서비스     | URL                                          | 시작 명령                                    |
| ---------- | -------------------------------------------- | -------------------------------------------- |
| 프론트엔드 | http://localhost:3000                        | `cd it_frontend && npm run dev`              |
| 백엔드 API | http://localhost:28080                       | `cd it_backend && ./gradlew bootRun`         |
| Swagger UI | http://localhost:28080/swagger-ui/index.html | (백엔드 기동 후)                             |
| Oracle DB  | 127.0.0.1:11521/XEPDB1                       | `sqlplus ITPAPP@127.0.0.1:11521/XEPDB1`      |

### 3.1.1 로컬 Oracle DB 접속

- DB 확인이 필요하면 `sqlplus ITPAPP@127.0.0.1:11521/XEPDB1`로 직접 접속하고 비밀번호는 sqlplus 콘솔 프롬프트에만 입력합니다.
- **로컬 개발 DB 한정 예외 — 자동 실행**: 사람이 프롬프트에 입력할 수 없는 자동 진단(에이전트·스크립트)은 `DB_PASSWORD` 환경변수를 **stdin으로만** 전달합니다. 명령행 인자(`sqlplus ITPAPP/비밀번호@접속자`)는 프로세스 목록과 셸 히스토리에 남으므로 **금지**합니다. 값을 화면·로그에 출력하지 않으며(존재 확인이 필요하면 설정 여부만 봅니다), 이 예외는 로컬 개발 DB에만 적용하고 dev/prod와 CI는 아래 Wallet 규정을 따릅니다.

  ```bash
  { printf '%s\n' "$DB_PASSWORD"; cat 진단.sql; } | sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1
  ```
- 기본 접속 정보는 Spring Boot 개발 설정과 동일합니다: `ITPAPP@127.0.0.1:11521/XEPDB1`.
- SQL 스크립트는 접속 후 `@경로\스크립트.sql`로 실행하거나, `sqlplus ITPAPP@127.0.0.1:11521/XEPDB1 @경로\스크립트.sql`로 한 번에 실행합니다.
- `sqlplus`가 없으면 SQLcl의 `sql` 명령을 동일한 인자로 사용합니다.
- CI·무인 실행은 비밀번호 환경변수나 프로세스 인자를 사용하지 않고 Oracle Secure External Password Store의 Wallet 별칭(`/@별칭`)만 사용합니다. Wallet 파일은 실행 계정만 읽을 수 있도록 권한을 제한합니다.

## 3.2 운영 환경

| 서비스     | URL                        | 시작 명령                            |
| ---------- | -------------------------- | ------------------------------------ |
| WebTobe    | https://it.kdb.co.kr:20443 | -----------                          |
| 프론트엔드 | (CSR)                      | `cd it_frontend; $env:SPRING_PROFILES_ACTIVE="prod"; npm run generate` |
| 백엔드 API | http://localhost:28080     | `cd it_backend && java -jar ooo.war` |

- 프론트 정적 생성의 프로파일은 백엔드와 같은 `SPRING_PROFILES_ACTIVE`를 사용합니다. PowerShell에서는 환경변수를 먼저 설정한 뒤 `npm run generate`를 실행하며, 미지정·미지원 프로파일은 `scripts/generate.mjs`가 실패로 종료합니다.
- DB 스키마 분리 (전 환경 공통): 접속 계정은 `ITPAPP`, 객체 소유 스키마는 `ITPOWN`(`ITPOWN.테이블명`으로 접근).
  베이스 설정이 `CURRENT_SCHEMA=ITPOWN`으로 세션을 전환하므로 코드에 스키마 접두어를 쓰지 않습니다.
  상세는 `it_backend/CLAUDE.md` §2 참조.

## 4. 공통 운영 규약 (모든 하위 프로젝트 적용)

### 4.1 한글 주석 원칙

- 모든 신규 주석(JavaDoc/TSDoc/인라인)은 한글.
- 단순 대입·트리비얼 메서드에는 주석을 추가하지 않습니다.
- public API, service 메서드, composable 반환 함수에는 입력값과 실패 조건을 함께 기록합니다.
- TODO/FIXME는 후속 조치가 가능한 문장으로 작성. 장기 과제는 `TASK.md`에 등록.
- 주석 현행화 작업에서는 실제 코드 동작과 불일치하는 설명만 보정하고, 별도 요청이 없으면 비즈니스 로직은 수정하지 않습니다.

### 4.2 인증 / 보안 (요약)

- 브라우저 인증은 백엔드가 발급하는 **httpOnly 쿠키**를 기본으로 하며 프론트엔드는 토큰을 직접 저장/읽지 않습니다. Bearer 헤더 폴백은 `app.auth.allow-bearer-header`가 명시적으로 활성화된 개발·API 테스트 환경에서만 허용합니다.
- 인증 API 호출은 `credentials: 'include'`.
- Access Token 15분 / Refresh Token 7일 (백엔드 SoT).
- 관리자 권한은 프론트 라우트 가드 + 백엔드 `SecurityConfig`/`@PreAuthorize` 이중 적용.
- 자격등급은 `ITPAD001=ROLE_ADMIN`, `ITPAD002=ROLE_INFOSEC_ADMIN`, `ITPZZ002=ROLE_DEPT_MANAGER`, 그 외 `ROLE_USER`로 매핑합니다. `ROLE_INFOSEC_ADMIN`은 일반 관리자 권한과 구분하며 협의회 심의유형 범위는 서버 서비스에서 검증합니다.
- 프론트의 `it-portal-user` 쿠키와 라우트 가드는 UX 보호용입니다. 서버 권한 판단은 반드시 JWT 클레임 기반 `@PreAuthorize` 또는 서비스 계층 권한 검증에서 수행합니다.
- 애플리케이션 DB 자격증명, JWT 시크릿, 외부 API 키는 운영 배포 시 환경변수 또는 비공개 프로파일에서 주입합니다. 단, Oracle 명령행 도구의 수동 실행은 콘솔 프롬프트를 사용하고 CI·무인 실행은 Wallet만 사용합니다.
- 운영 프로파일은 비밀값·허용 Origin·프론트 URL을 fail-fast로 검증하고 SSO 직접 사번, 개발 사용자 전환, 모의 SSO, Bearer 폴백, 비보안 쿠키 설정을 허용하지 않습니다.
- 수동 로그인과 사용자 전자결재 상태 변경에는 추가 인증(지정맥·FIDO·mOTP)을 강제합니다. 증표는 사용자·용도에 귀속된 1회용이며 서버 메모리에만 둡니다. SSO, 개발 사용자 전환, 조회·임시저장, 외부 결재 콜백은 대상이 아닙니다.
- 상세 정책은 `it_backend/CLAUDE.md` 인증 섹션을 SoT로 따릅니다.

### 4.3 문서 관리

- `README.md` — 신규 개발자가 흐름을 파악하는 개발 노트
- `CLAUDE.md` — 실제 코드에서 확인된 규칙만 기록 (휘발성/카운트 정보 금지)
- `TASK.md` — 미구현, 기술 부채, 보안/성능/테스트 보강 과제
- REVIEW 현행화에서 확인한 파일 수·테스트 수 같은 시점성 정보는 `README.md` 변경 이력 또는 `TASK.md` 업데이트 메모에만 기록하고, `CLAUDE.md`에는 재사용 가능한 규칙과 정책만 남깁니다.
- REVIEW 중 발견한 운영 소스 외부(벤더 샘플, 로컬 저장소 반입 스크립트 등)의 이슈는 코드 규칙으로 일반화하지 않고, 필요 시 `TASK.md`에 분리 정리 대상으로 기록합니다.

작업 추적 채널별 역할:

| 채널               | 역할                                                        |
| ------------------ | ----------------------------------------------------------- |
| `TASK.md`          | 활성 기술부채·미구현 과제 (SoT)                             |
| `TASK_DONE.md`     | 완료 과제 이관 보관                                         |
| `docs/superpowers/` | 구현 계획·스펙 산출물 (`plans/`, `specs/`, 완료 시 `done/` 하위 이관) |
| `prds/`            | 제품 요구사항 문서                                          |
| `docs/prompts/`    | 일회성 작업 지시문 (휘발성, 완료 후 보관용)                 |
| `TaskNotes/`       | 개인 Obsidian 노트. 2026-08-17 추적 해제 — 저장소 밖에서 관리하며 공유가 필요한 내용은 `TASK.md`·`docs/`로 흡수 |

저장소 루트의 도구 산출물·로컬 하네스 설정(`.claude/`, `.agents/`, `.superpowers/`, `.review-cache/`, `.playwright-mcp/`, `graphify-out/`)은 추적하지 않습니다. 개발자 환경마다 다르거나 재생성 가능한 파일이므로, 공유해야 할 결론은 반드시 저장소 문서(`docs/`, `FP/` 등)에 옮겨 적습니다.

### 4.4 데이터베이스 마이그레이션 (Flyway)

> **현황**: 백엔드에 Flyway 런타임(`flyway-core`, `flyway-database-oracle`)이 통합되어 있습니다.
> Gradle `processResources`가 `it_database/migrations/V*.sql`을 빌드 산출물의 `classpath:db/migration`으로 포함합니다.
> `local-ext`/`local-int` 프로파일의 개발 기동은 IDE와 `bootRun`에서 동일하게 동작하도록 형제 디렉터리의
> `filesystem:../it_database/migrations`를 직접 읽어 신규 마이그레이션을 적용합니다. `dev`/`prod` DB는 DBA가 적용합니다.

- **경로**: `it_database/migrations/`
- **네이밍 규칙**: `V{YYYYMMDD_NNN}__{설명}.sql`
  - 예: `V20260516_001__CreateCcodemTable.sql`, `V20260516_002__AddBudgetIndexes.sql`
  - 첫 8자리 날짜 + 일련번호 3자리로 버전 정렬 (Flyway 네이밍 규칙).
  - 설명은 CamelCase, 기능/테이블/변경 의도 명확히.
- **내용**: DDL (테이블/인덱스/시퀀스) + DML (초기화/데이터 마이그레이션).
- **적용 프로파일**: `spring.flyway.enabled=false`가 기본값이며 `application-local-ext.properties`, `application-local-int.properties`에서만 `true`로 켭니다.
- **기존 스키마 기준**: `spring.flyway.baseline-on-migrate=true`, `baseline-version=20260620.001`로 기존 로컬 ITPOWN 스키마를 현재 기준선으로 등록하고 이후 신규 V\* 스크립트부터 자동 적용합니다.
- **빈 스키마 기준**: schema history가 없는 빈 스키마에서는 `it_database/migrations/`의 전체 V\* 스크립트를 순서대로 적용합니다.
- **운영 계정 분리**: 애플리케이션 계정에 DDL 권한이 없으면 `FLYWAY_USER`/`FLYWAY_PASSWORD`로 Flyway 전용 DDL 계정을 지정합니다.
- **주의**: 적용된 스크립트는 Flyway 체크섬 추적 대상이므로 수정 금지. 변경은 항상 새 버전 스크립트로 추가합니다.

### 4.5 런타임 로그

- 백엔드 파일 로그는 1개월 단위 롤오버. 모든 프로파일의 기본 경로는 `/log/springitp`입니다. 상세는 `it_backend/docs/guides/operations/logging.md`를 따릅니다.

## 5. AI 하네스 가이드

### 5.1 기본 워크플로우

- 신규 기능, 구조 변경, TDD가 필요한 작업은 **Superpowers** 스킬을 기본으로 사용합니다.
- 요구사항 구체화: `/superpowers:brainstorming`
- 구현 계획: `/superpowers:writing-plans`
- 계획 실행: `/superpowers:executing-plans`
- 디버깅: `/superpowers:systematic-debugging`
- TDD: `/superpowers:test-driven-development`
- 완료 전 검증: `/superpowers:verification-before-completion`
- 산출물은 `docs/superpowers/`에 우선 보관합니다.

### 5.2 보조 워크플로우

- 프레임워크별 패턴은 `.claude/skills/`에 선별해 둔 참조 스킬(§5.4)로 확인합니다. 스킬은 일반 프레임워크 관례를 담은 **참고 자료**이며, 본 프로젝트 규칙과 충돌하면 항상 저장소 `CLAUDE.md`와 `docs/guides/`가 이깁니다.
- 브라우저 기반 QA는 두 서버를 모두 기동한 뒤 Playwright MCP로 수행합니다.
- 테스트 대상: http://localhost:3000
- API 서버: http://localhost:28080
- 핵심 시나리오: 로그인, 프로젝트 조회/생성, 결재 처리

### 5.3 워크플로우 스킬

워크플로우 플러그인은 **Superpowers** 하나만 사용합니다(그 외 프로젝트 활성 플러그인은 Playwright MCP와 claude-md-management). 프로젝트 전용 서브에이전트 정의(`.claude/agents/`)는 두지 않으므로, 문서에 등장하는 역할 이름은 범용 서브에이전트에 부여하는 역할 지시로 해석합니다.

| 스킬                                           | 제공          | 용도                   |
| ---------------------------------------------- | ------------- | ---------------------- |
| `/superpowers:brainstorming`                   | Superpowers   | 요구사항 구체화        |
| `/superpowers:writing-plans`                   | Superpowers   | 구현 계획 수립         |
| `/superpowers:executing-plans`                 | Superpowers   | 계획 기반 구현         |
| `/superpowers:test-driven-development`         | Superpowers   | 테스트 우선 개발       |
| `/superpowers:verification-before-completion`  | Superpowers   | 완료 전 검증           |
| `/superpowers:systematic-debugging`            | Superpowers   | 버그·오류 원인 분석    |
| `/superpowers:requesting-code-review`          | Superpowers   | 코드 리뷰 요청 절차    |
| `/code-review`                                 | Claude Code   | 코드 리뷰 (diff 기준)  |
| `/security-review`                             | Claude Code   | 변경분 보안 검토       |

### 5.4 프레임워크 참조 스킬

본 프로젝트 스택에 해당하는 스킬만 `.claude/skills/`에 선별해 두었습니다. 해당 영역의 코드를 작성·검토하기 전에 읽고, 아래 「프로젝트 적용 시 주의」를 함께 확인합니다.

| 스킬                     | 적용 영역     | 언제 사용                                             |
| ------------------------ | ------------- | ----------------------------------------------------- |
| `/springboot-patterns`   | `it_backend`  | 컨트롤러·서비스·레이어 구조, REST 설계, 캐싱, 비동기  |
| `/java-coding-standards` | `it_backend`  | 네이밍, 불변성, `Optional`, 스트림, 예외 처리         |
| `/jpa-patterns`          | `it_backend`  | 엔티티·연관관계 설계, 쿼리 최적화, 트랜잭션, 페이징   |
| `/springboot-security`   | `it_backend`  | 인증·인가, 입력 검증, CSRF, 보안 헤더, 비밀값         |
| `/springboot-tdd`        | `it_backend`  | JUnit 5·Mockito·MockMvc 테스트 작성                   |
| `/springboot-verification` | `it_backend` | 빌드·정적분석·커버리지까지 이어지는 완료 전 검증 루프 |
| `/vue-patterns`          | `it_frontend` | Composition API, 컴포넌트 구조, Pinia, Vue Router     |

**프로젝트 적용 시 주의** — 스킬은 일반 관례 기준이라 아래 대목은 프로젝트 규칙이 우선합니다.

- 프론트는 **CSR 전용**입니다(`nuxt.config.ts`의 `ssr: false`, `npm run generate`). `/vue-patterns`의 SSR·하이드레이션 지침과 `useFetch`/`useAsyncData` 예시는 적용하지 않습니다. 서버 요청은 프로젝트 래퍼 `useApiFetch`(GET)·`$apiFetch`(명령형)를 쓰며 `it_frontend/docs/guides/architecture/api-client.md`가 SoT입니다.
- 스키마 변경은 JPA `ddl-auto`가 아니라 `it_database/migrations/`의 Flyway 스크립트로만 합니다(§4.4). `/jpa-patterns`의 인덱스·DDL 예시는 그대로 실행하지 않습니다.
- `/springboot-tdd`의 Testcontainers 예시 대신, 실제 Oracle 의존 검증은 `./gradlew integrationTest`로 분리합니다.
- `/springboot-verification`의 명령 예시보다 §6 Health Stack의 실제 명령을 사용합니다.

`/springboot-security`는 예외가 아닙니다 — httpOnly·Secure·SameSite 쿠키 권고가 본 프로젝트 방침과 일치하므로 그대로 적용합니다.

Nuxt 전용 스킬(`nuxt4-patterns`)은 내용 대부분이 SSR·Nitro 라우트 규칙 전제라 CSR 전용인 이 프로젝트에 맞지 않아 제외했습니다. Nuxt 관련 판단은 `it_frontend/CLAUDE.md`와 `it_frontend/docs/guides/`를 따릅니다.

`.claude/`는 `.gitignore` 대상이므로 이 스킬들은 로컬 전용입니다. 다른 개발자 환경에는 없을 수 있으니, 스킬에서 얻은 결론은 반드시 저장소 문서나 코드로 근거를 남깁니다.

## 6. Health Stack

| 명령                                       | 디렉토리      | 용도                                  |
| ------------------------------------------ | ------------- | ------------------------------------- |
| `npm run format:check`                     | `it_frontend` | Prettier 검사                         |
| `npm run check`                            | `it_frontend` | 타입 검사, ESLint, 고정 문구 ratchet  |
| `npm run check:copy`                       | `it_frontend` | 사용자 노출 고정 리터럴 ratchet 단독 실행 |
| `npm run lint:css`                         | `it_frontend` | CSS 변경 시 Stylelint                 |
| `npm test`                                 | `it_frontend` | 프론트 단위 테스트                    |
| `npm run test:e2e`                         | `it_frontend` | 핵심 사용자 흐름 E2E 테스트           |
| `npm run codegen:check`                    | `it_frontend` | 백엔드 스펙과 프론트 생성 타입 드리프트 검사 |
| `./gradlew test`                           | `it_backend`  | 백엔드 단위·슬라이스 테스트           |
| `./gradlew check`                          | `it_backend`  | 포맷·테스트·커버리지 품질 게이트       |
| `./gradlew integrationTest`                | `it_backend`  | 실제 Oracle 매핑·QueryDSL 통합 테스트 |
| `./gradlew jacocoTestCoverageVerification` | `it_backend`  | 설정된 커버리지 기준 확인             |
