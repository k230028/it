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

각 영역의 단일 진실 공급원(Single Source of Truth):

| 토픽                                                                | SoT                                                                                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 백엔드 기술 스택 / API 설계 / 엔티티 / 인증 정책 / 운영 비밀값 기준 | `it_backend/CLAUDE.md`                                                                                                            |
| 프론트엔드 기술 스택 / 컴포넌트 / 라우팅 / 클라이언트 인증 책임     | `it_frontend/CLAUDE.md`                                                                                                           |
| 데이터 모델                                                         | 물리 구조=`it_database/migrations/`, ORM 매핑=`it_backend` 엔티티, 조회 인덱스=`it_backend/docs/guides/persistence/data-model.md` |
| 컴포넌트 가이드 (StyledDataTable 등)                                | `it_frontend/docs/guides/`                                                                                                        |
| 공통 게시판 도메인 규칙                                             | `it_backend/CLAUDE.md`, `it_frontend/CLAUDE.md`                                                                                   |
| 엔티티, 컬럼명 명명 규칙 (메타용어사전)                             | `C:\it\meta\meta.txt`                                                                                                             |

## 3.1 개발 환경

| 서비스     | URL                                          | 시작 명령                                    |
| ---------- | -------------------------------------------- | -------------------------------------------- |
| 프론트엔드 | http://localhost:3000                        | `cd it_frontend && npm run dev`              |
| 백엔드 API | http://localhost:28080                       | `cd it_backend && ./gradlew bootRun`         |
| Swagger UI | http://localhost:28080/swagger-ui/index.html | (백엔드 기동 후)                             |
| Oracle DB  | 127.0.0.1:11521/XEPDB1                       | `sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1` |

### 3.1.1 로컬 Oracle DB 접속

- DB 확인이 필요하면 `sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1`로 직접 접속합니다.
- 기본 접속 정보는 Spring Boot 개발 설정과 동일합니다: `ITPAPP@127.0.0.1:11521/XEPDB1`.
- SQL 스크립트는 접속 후 `@경로\스크립트.sql`로 실행하거나, `sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1 @경로\스크립트.sql`로 한 번에 실행합니다.
- `sqlplus`가 없으면 SQLcl의 `sql` 명령을 동일한 인자로 사용합니다.

## 3.2 운영 환경

| 서비스     | URL                        | 시작 명령                            |
| ---------- | -------------------------- | ------------------------------------ |
| WebTobe    | https://it.kdb.co.kr:20443 | -----------                          |
| 프론트엔드 | (CSR)                      | `cd it_frontend && npm run generate` |
| 백엔드 API | http://localhost:28080     | `cd it_backend && java -jar ooo.war` |

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
- DB 비밀번호, JWT 시크릿, 외부 API 키는 운영 배포 시 환경변수 또는 비공개 프로파일에서 주입합니다.
- 운영 프로파일은 비밀값·허용 Origin·프론트 URL을 fail-fast로 검증하고 SSO 직접 사번, 개발 사용자 전환, 모의 SSO, Bearer 폴백, 비보안 쿠키 설정을 허용하지 않습니다.
- 상세 정책은 `it_backend/CLAUDE.md` 인증 섹션을 SoT로 따릅니다.

### 4.3 문서 관리

- `README.md` — 신규 개발자가 흐름을 파악하는 개발 노트
- `CLAUDE.md` — 실제 코드에서 확인된 규칙만 기록 (휘발성/카운트 정보 금지)
- `TASK.md` — 미구현, 기술 부채, 보안/성능/테스트 보강 과제
- REVIEW 현행화에서 확인한 파일 수·테스트 수 같은 시점성 정보는 `README.md` 변경 이력 또는 `TASK.md` 업데이트 메모에만 기록하고, `CLAUDE.md`에는 재사용 가능한 규칙과 정책만 남깁니다.
- REVIEW 중 발견한 운영 소스 외부(벤더 샘플, 로컬 저장소 반입 스크립트 등)의 이슈는 코드 규칙으로 일반화하지 않고, 필요 시 `TASK.md`에 분리 정리 대상으로 기록합니다.

### 4.4 데이터베이스 마이그레이션 (Flyway)

> **현황**: 백엔드에 Flyway 런타임(`flyway-core`, `flyway-database-oracle`)이 통합되어 있습니다.
> Gradle `processResources`가 `it_database/migrations/V*.sql`을 `classpath:db/migration`으로 포함하고,
> `local-ext`/`local-int` 프로파일 기동 시 신규 마이그레이션을 적용합니다. `dev`/`prod` DB는 DBA가 적용합니다.

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

- 백엔드 파일 로그는 1개월 단위 롤오버. 경로: local `c:/itp_log`, dev/prod `/log/springitp`. 상세는 `it_backend/docs/guides/operations/logging.md`를 따릅니다.

## 5. AI 하네스 가이드

### 5.1 기본 워크플로우

- 신규 기능, 구조 변경, TDD가 필요한 작업은 **Superpowers**를 기본으로 사용합니다.
- 요구사항 구체화: `/brainstorming`
- 구현 계획: `/write-plan`
- 계획 실행: `/execute-plan`
- 디버깅: `/systematic-debugging`
- TDD: `/test-driven-development`
- 완료 전 검증: `/verification-before-completion`
- 산출물은 `docs/superpowers/`에 우선 보관합니다.

### 5.2 보조 워크플로우

- **ECC**: Spring Boot, Nuxt, 테스트, 보안 등 프레임워크별 패턴 확인에 사용합니다.
- **gstack**: 두 서버를 모두 기동한 뒤 브라우저 기반 QA, 리뷰, 배포 전 점검에 사용합니다.
- 테스트 대상: http://localhost:3000
- API 서버: http://localhost:28080
- 핵심 시나리오: 로그인, 프로젝트 조회/생성, 결재 처리

### 5.3 주요 스킬

| 스킬                              | 용도                               |
| --------------------------------- | ---------------------------------- |
| `/brainstorming`                  | 요구사항 구체화                    |
| `/write-plan`                     | 구현 계획 수립                     |
| `/execute-plan`                   | 계획 기반 구현                     |
| `/test-driven-development`        | 테스트 우선 개발                   |
| `/verification-before-completion` | 완료 전 검증                       |
| `/qa`                             | 화면 기능 테스트 (브라우저 자동화) |
| `/investigate`                    | 버그·오류 원인 분석                |
| `/review`                         | 코드 리뷰 (diff 기준)              |
| `/ship`                           | PR 생성 및 배포                    |
| `/health`                         | 코드 품질 점검                     |
| `/checkpoint`                     | 작업 중간 저장 및 복원             |

## 6. Health Stack

| 명령                                       | 디렉토리      | 용도                                  |
| ------------------------------------------ | ------------- | ------------------------------------- |
| `npm run format:check`                     | `it_frontend` | Prettier 검사                         |
| `npm run check`                            | `it_frontend` | 타입 검사와 ESLint                    |
| `npm run lint:css`                         | `it_frontend` | CSS 변경 시 Stylelint                 |
| `npm test`                                 | `it_frontend` | 프론트 단위 테스트                    |
| `npm run test:e2e`                         | `it_frontend` | 핵심 사용자 흐름 E2E 테스트           |
| `./gradlew test`                           | `it_backend`  | 백엔드 단위·슬라이스 테스트           |
| `./gradlew integrationTest`                | `it_backend`  | 실제 Oracle 매핑·QueryDSL 통합 테스트 |
| `./gradlew jacocoTestCoverageVerification` | `it_backend`  | 설정된 커버리지 기준 확인             |
