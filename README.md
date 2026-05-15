# IT Project Portal — 모노레포 개발 가이드

## 1. 프로젝트 개요

**IT Project Portal (IT 정보화 포탈)**  
정보화 예산, 사업, 인력을 관리하는 사내 포털 시스템입니다.

- **사용자:** 약 3,000명의 임직원
- **주요 기능:** 정보화사업 신청, 예산 현황 조회, 전자결재, 요구사항 정의서 검토, 협의회 관리
- **기술 스택:**
  - **프론트엔드:** Nuxt 4 (Vue 3 Composition API) + PrimeVue + Tailwind CSS
  - **백엔드:** Spring Boot 4 + Oracle Database 21c XE + JPA/QueryDSL
  - **인증:** JWT httpOnly 쿠키 기반 (Access 15분 / Refresh 7일)
  - **변경 추적:** JPA 리스너 기반 자동 감사로그 (23개 도메인)

---

## 2. 모노레포 디렉토리 구조

```
it/
├── it_frontend/          ← Nuxt 4 웹 애플리케이션 (CSR 모드)
│   ├── README.md         ← 프론트엔드 상세 가이드
│   ├── CLAUDE.md         ← 프론트 기술 결정 & API 맵
│   ├── app/              ← 소스 루트 (Nuxt 4 convention)
│   │   ├── pages/        ← 파일 기반 라우팅 (52개 페이지)
│   │   ├── components/   ← 재사용 컴포넌트 (67개)
│   │   ├── composables/  ← 비즈니스 로직 (45개)
│   │   ├── stores/       ← Pinia 상태관리 (인증/사전협의)
│   │   └── types/        ← TypeScript 타입 정의 (5개)
│   └── tests/            ← Vitest + Playwright 테스트
│
├── it_backend/           ← Spring Boot 4 REST API 서버
│   ├── README.md         ← 백엔드 상세 가이드
│   ├── CLAUDE.md         ← 백엔드 기술 결정 & 보안 정책
│   ├── src/main/java/    ← 소스 코드
│   │   └── com/kdb/it/
│   │       ├── config/   ← Spring 설정 (보안, JPA, Swagger 등)
│   │       ├── common/   ← 공통 모듈 (인증, 게시판, 결재)
│   │       ├── domain/   ← 비즈니스 도메인 (예산, 협의회, 문서)
│   │       ├── infra/    ← 외부 연동 (파일, Gemini AI)
│   │       └── exception/ ← 전역 예외 처리
│   ├── src/test/java/    ← JUnit 5 + Mockito 테스트 (50개 파일)
│   └── build.gradle      ← Gradle 빌드 스크립트
│
├── it_database/          ← Oracle DB 마이그레이션 & 초기화
│   ├── migrations/       ← Flyway SQL 마이그레이션 (최신 버전)
│   ├── seeds/            ← 초기 데이터 (공통코드, 사용자)
│   └── connect-db.ps1    ← 로컬 DB 접속 스크립트 (PowerShell)
│
├── docs/                 ← PDCA 문서 & 아카이브
│   ├── 01-plan/          ← 피처 계획서
│   ├── 02-design/        ← 설계서
│   ├── 03-analysis/      ← 분석 보고서
│   ├── 04-report/        ← 완료 보고서
│   ├── archive/          ← 과거 아카이브
│   └── superpowers/      ← 워크플로우 플랜 & 스펙
│
├── CLAUDE.md             ← 모노레포 공통 규약 (인증, 주석, 보안)
├── TASK.md               ← 미구현 기능, 기술 부채, 보안 과제
├── README.md             ← 이 파일
└── .agents/              ← AI 에이전트 확장 설정

---

## 3. 로컬 개발 환경 설정

### 3.1 필수 요구사항

| 항목 | 버전 | 설치 방법 |
|------|------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| Java | 25 | JDK 25 설치, `JAVA_HOME` 환경변수 설정 |
| Oracle Client | 21c+ | [Oracle Database Express Edition](https://www.oracle.com/database/technologies/xe-downloads.html) |
| Git | 2.30+ | 기본 설치 |

### 3.2 로컬 시작 명령어

**터미널 1: 프론트엔드 (포트 3000)**
```bash
cd it_frontend
npm install         # 최초 1회
npm run dev
# http://localhost:3000
```

**터미널 2: 백엔드 (포트 8080)**
```bash
cd it_backend
./gradlew bootRun   # Windows: .\gradlew.bat bootRun
# http://localhost:8080
# Swagger UI: http://localhost:8080/swagger-ui/index.html
```

**터미널 3: Oracle DB 접속 (선택)**
```bash
# Windows PowerShell
cd it_database
.\connect-db.ps1    # 또는 .\connect-db.bat
# sqlplus ITPAPP@XEPDB1
```

### 3.3 개발 설정 체크

```bash
# 프론트엔드 타입 체크
cd it_frontend && npx nuxt typecheck

# 프론트엔드 린트
cd it_frontend && npx eslint .

# 백엔드 빌드
cd it_backend && ./gradlew build

# 프론트엔드 단위 테스트
cd it_frontend && npm test

# 백엔드 테스트
cd it_backend && ./gradlew test
```

---

## 4. 개발/운영 환경 URL

| 서비스 | 개발 | 운영 |
|--------|------|------|
| **프론트엔드** | http://localhost:3000 | https://it.kdb.co.kr:20443 (CSR) |
| **백엔드 API** | http://localhost:8080 | http://localhost:8080 (Tomcat WAR) |
| **Swagger UI** | http://localhost:8080/swagger-ui/index.html | (동일) |
| **Oracle DB** | 127.0.0.1:1521/XEPDB1 (ITPAPP) | 운영 배포 설정 |

---

## 5. 프로젝트별 상세 문서

각 프로젝트의 자세한 기술 결정, API 설계, 보안 정책은 다음 파일을 참조하세요:

- **백엔드 (Spring Boot):** [`it_backend/CLAUDE.md`](./it_backend/CLAUDE.md)
  - 인증 & 보안 정책, 도메인 구조, API 엔드포인트, 환경 설정
  
- **프론트엔드 (Nuxt 4):** [`it_frontend/CLAUDE.md`](./it_frontend/CLAUDE.md)
  - 기술 스택, 라우팅, 상태 관리, API 래퍼 패턴, Tiptap 통합

- **공통 규약:** [`CLAUDE.md`](./CLAUDE.md)
  - 인증 정책 (SoT), 한글 주석 원칙, 개발 워크플로우, 공통 게시판 도메인 규칙

---

## 6. Health Stack (빠른 품질 확인)

신규 개발 또는 코드 변경 후 아래 명령어로 품질을 확인합니다:

```bash
# 프론트엔드 타입 체크
cd it_frontend && npx nuxt typecheck

# 프론트엔드 린트
cd it_frontend && npx eslint .

# 프론트엔드 단위 테스트
cd it_frontend && npx vitest run

# 백엔드 테스트
cd it_backend && ./gradlew test

# 백엔드 커버리지 리포트 (JaCoCo)
cd it_backend && ./gradlew jacocoTestReport
# 리포트: build/reports/jacoco/test/html/index.html
```

---

## 7. AI 하네스 구성

본 프로젝트는 **Agentic Engineering** 기반 개발 워크플로우를 사용합니다.

```
┌──────────────────────────────────────────────────────────┐
│  gstack      — 브라우저 QA·리뷰·배포 슬래시 명령어       │
│  bkit PDCA   — 피처 단위 계획→설계→실행→검증 워크플로우 │
│  ECC         — Spring Boot·Nuxt 패턴·스킬 라이브러리    │
│  Superpowers — 계획·디버깅·TDD·아이디어 메타 워크플로우 │
└──────────────────────────────────────────────────────────┘
```

### 2.1 올바른 프롬프트 지침 가이드

[간단한 기능]은 프롬프트에서 대화하듯이 진행하면 됩니다.
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

[복잡한 기능]은 별도 md 파일로 요구사항(prd)를 작성하여 지시하고, 항상 문서화 및 TDD(테스트 주도 개발)에 대해 강조합니다. 문서화와 TDD는 별도 REVIEW.md, TEST.md를 통해 주기적으로 현행화하지만 적시에 반영하는게 가장 정확하고 효율적입니다.

> [!note] 주의사항
> 서로 관련이 없는 많은 기능을 하나의 md 파일에 정의해서 한번에 계획 및 설계서를 작성하는 것은 아직 권고하지 않습니다. 

 ```
> /pdca plan C:\it\TASK.md 이행계획 작성해줘. 이행 후 C:\it\TASK.md 현행화 계획을 포함하고, 동일한 문제가 재발하지 않도록 코딩 컨벤션 등에 반영하여 앞으로 유의해야 할 부분이 있다면 각 프로젝트 폴더 readme.md, claude.md에 반영해줘. TDD 방법론도 적용해줘.

1. /pdca plan {기능 요구사항}         ← bkit: 계획 수립
2. /pdca next                       ← bkit: 구현 단계 진입
3. /verification-before-completion  ← Superpowers: 완료 전 검증
4. /qa                              ← gstack: 브라우저 테스트 
5. /review                          ← gstack: 코드 리뷰
6. /ship                            ← gstack: PR 배포
 ```

[요구사항 구체화] 요구사항이 구체화되지 않았거나 조언이 필요한 경우 /brainstorming으로 시작하는게 좋습니다.
```
> /brainstorming C:\it\TEST.md 활동이 더 agents, team, rule, skill을 종합적으로 활용해서 효과적으로 동작할 수 있도록 개선할 여지가 있는지 확인해줘

1. /brainstorming {기능 아이디어}     ← Superpowers: 기능 구체화
2. /pdca plan {기능 요구사항}         ← bkit: 계획 수립
3. /pdca next                       ← bkit: 구현 단계 진입
4. /verification-before-completion  ← Superpowers: 완료 전 검증
5. /qa                              ← gstack: 브라우저 테스트 
6. /review                          ← gstack: 코드 리뷰
7. /ship                            ← gstack: PR 배포
```

---
## 8. gstack — 브라우저 기반 운영 명령어

gstack은 **슬래시 명령어 형태의 전문가 팀**입니다. 두 서버가 모두 기동된 상태에서 사용합니다.

```bash
# 서버 기동 (각각 별도 터미널)
cd it_backend  && ./gradlew bootRun
cd it_frontend && npm run dev
```

### 8.1 핵심 명령어

| 명령어 | 용도 | 사용 시점 |
|--------|------|-----------|
| `/qa` | 브라우저 자동화 품질 테스트 | 기능 구현 완료 후 |
| `/investigate` | 버그·500 오류 원인 분석 | 에러 발생 시 |
| `/review` | git diff 기준 코드 리뷰 | 커밋 전 |
| `/ship` | PR 생성 및 배포 | 배포 준비 완료 시 |
| `/health` | 코드 품질 전반 점검 | 주기적 품질 관리 |
| `/checkpoint` | 작업 상태 저장·복원 | 긴 작업 중간 저장 |

### 8.2 핵심 테스트 시나리오 (`/qa`)

- 테스트 결과 파일 위치: `it\.gstack\qa-reports`

---
## 9. bkit PDCA — 피처 단위 구조화 개발

bkit은 **PDCA 방법론 기반 피처 개발 워크플로우**입니다. 계획→설계→실행→검증→아카이브 순으로 진행합니다.

### 9.1 기본 명령어

```bash
/pdca plan {기능 요구사항}    # 새 피처 시작 (계획 단계)
/pdca status                  # 현재 진행 상태 확인
/pdca next                    # 다음 단계로 이동
```

### 9.2 피처 진행 단계

```
plan → design → do → analysis → archive
 계획     설계    실행    검증       아카이브
```

### 9.3 생성 문서 위치

| 문서 | 경로 |
|------|------|
| 계획서 | `docs/01-plan/features/{feature}.plan.md` |
| 설계서 | `docs/02-design/features/{feature}.design.md` |
| 보고서 | `docs/04-report/{feature}.report.md` |
| 상태 파일 | `.bkit/state/pdca-status.json` |

---

## 10. ECC (Everything Claude Code) — 패턴 스킬 라이브러리

ECC는 **프레임워크별 Best Practice 스킬 모음**입니다. IT Portal에 직접 연관된 스킬:

### 10.1 백엔드 (Spring Boot)

```bash
/springboot-patterns       # 레이어드 아키텍처, JPA, 예외처리 패턴
/springboot-tdd            # Spring Boot TDD 워크플로우
/springboot-verification   # 구현 완료 후 검증 체크리스트
/springboot-security       # Spring Security, JWT, RBAC 패턴
/backend-patterns          # API 설계, 페이지네이션, 캐싱
/api-design                # REST API 설계 원칙
```

### 10.2 프론트엔드 (Nuxt 4)

```bash
/nuxt4-patterns            # Nuxt 4 컴포저블, 상태관리, 라우팅 패턴
/frontend-design           # UI/UX 컴포넌트 설계 원칙
/frontend-patterns         # Vue 3 Composition API 패턴
```

### 10.3 품질·보안

```bash
/tdd-workflow              # TDD 실천 워크플로우
/security-review           # OWASP Top 10, 보안 취약점 스캔
/plankton-code-quality     # 코드 품질 종합 분석
```

---

## 11. Superpowers — 메타 워크플로우 스킬

Superpowers는 **개발 방법론 수준의 워크플로우 스킬**입니다 (v5.0.7). 특정 작업 전 AI의 접근 방식 자체를 정의합니다.

| 스킬                                | 용도            | 사용 시점       |
| --------------------------------- | ------------- | ----------- |
| `/brainstorming`                  | 아이디어 구체화·탐색   | 기능 구상 단계    |
| `/write-plan`                     | 구조화된 구현 계획 작성 | 복잡한 기능 착수 전 |
| `/execute-plan`                   | 작성된 계획 단계별 실행 | 계획 수립 후     |
| `/systematic-debugging`           | 체계적 디버깅 워크플로우 | 원인 불명 버그    |
| `/test-driven-development`        | TDD 강제 워크플로우  | 새 기능·버그픽스   |
| `/verification-before-completion` | 완료 전 최종 검증    | PR 생성 직전    |

---

## 12. IT Portal 에이전트 팀

에이전트는 `~/.claude/agents/`에 설치된 ECC 전문가 에이전트입니다.  
Claude가 상황에 따라 자동으로 활성화하거나, 요청 시 서브에이전트로 직접 호출합니다.

### 12.1 백엔드 (Spring Boot 4 · Java 25 · Oracle · JPA/QueryDSL)

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `java-reviewer` | 레이어드 아키텍처·JPA 패턴·트랜잭션·동시성 리뷰 | Controller/Service/Repository 수정 후 |
| `java-build-resolver` | Gradle 빌드·컴파일·의존성 에러 수정 | `./gradlew build` 실패 시 |
| `database-reviewer` | JPA 엔티티·QueryDSL 쿼리·N+1·인덱스 설계 리뷰 | 쿼리·스키마 변경 시 |
| `security-reviewer` | JWT·Spring Security·RBAC·OWASP Top 10 취약점 스캔 | 인증/인가 코드 변경 전 커밋 |

### 12.2 프론트엔드 (Nuxt 4 · TypeScript · Vue 3 · PrimeVue · Pinia)

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `typescript-reviewer` | 타입 안전성·`useApiFetch`·`$apiFetch` 패턴·Composable 구조 리뷰 | `.vue`·`.ts` 수정 후 |
| `e2e-runner` | Playwright 기반 E2E 시나리오 생성·실행·유지 | 화면 기능 구현 완료 후 |
| `build-error-resolver` | TypeScript·Nuxt 빌드 오류 수정 | `npx nuxt typecheck` 실패 시 |

### 12.3 품질 · 보안

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `code-reviewer` | 풀스택 코드 품질·가독성·패턴 리뷰 | 모든 코드 변경 후 (자동 활성화) |
| `silent-failure-hunter` | 에러 삼킴·빈 catch·누락된 에러 전파 탐지 | 서비스·컨트롤러 신규 작성 시 |
| `pr-test-analyzer` | PR 테스트 커버리지·행동 커버리지 평가 | PR 생성 전 |
| `tdd-guide` | 테스트 먼저 작성(RED→GREEN→IMPROVE) 워크플로우 강제 | 새 기능·버그픽스 착수 시 |

### 12.4 계획 · 설계

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `planner` | 구현 청사진·파일·인터페이스·빌드 순서 설계 | 복잡한 기능 착수 전 |
| `code-architect` | 기존 패턴 분석 기반 기능 아키텍처 설계 | 신규 도메인 추가 시 |
| `architect` | 시스템 확장성·기술 결정 분석 | 아키텍처 변경 검토 시 |
| `performance-optimizer` | 쿼리·번들·렌더링 병목 분석·최적화 | 성능 이슈 발생 시 |

### 12.5 문서 · 유지보수

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `doc-updater` | CLAUDE.md·README·가이드 문서 동기화 | 코드 구조 변경 후 |
| `refactor-cleaner` | 미사용 코드·중복·dead import 정리 | 주기적 코드 정비 시 |
| `code-simplifier` | 최근 변경 코드 간결화·일관성 개선 | 기능 구현 완료 직후 |

---

## 13. 워크플로우 가이드

### 13.1 새 기능 개발 (풀스택)

**필수 단계** — 매 기능마다 실행:
```
1. /brainstorming {기능 아이디어}     ← Superpowers: 기능 구체화
2. /pdca plan {기능 요구사항}         ← bkit: 계획 수립
3. /pdca next                       ← bkit: 구현 단계 진입
4. /verification-before-completion  ← Superpowers: 완료 전 검증
5. /qa                              ← gstack: 브라우저 테스트
6. /review                          ← gstack: 코드 리뷰
7. /ship                            ← gstack: PR 배포
```

**선택 단계** — 필요한 경우에만 실행:
```
/springboot-patterns    ← 신규 도메인 착수 시 Spring Boot 컨벤션 확인
/nuxt4-patterns         ← 신규 도메인 착수 시 Nuxt 4 컨벤션 확인
/tdd-workflow           ← TDD를 엄격히 강제하고 싶을 때 (평소엔 "테스트도 작성해줘"로 충분)
```

### 13.2 버그 수정

```
1. /investigate                     ← gstack: 원인 분석
2. /systematic-debugging            ← Superpowers: 체계적 디버깅
3. /test-driven-development         ← Superpowers: 테스트 먼저 작성
4. /qa                              ← gstack: 회귀 테스트
```

### 13.3 코드 품질 점검

```
1. /health                          ← gstack: 전반적 품질
2. /security-review                 ← ECC: 보안 취약점
3. /plankton-code-quality           ← ECC: 코드 품질 분석
```

### 13.4 정기 정비

| 작업 | 시작 방법 |
|------|-----------|
| 전체 코드·구조 정비 | `REVIEW.md 진행해줘` |
| 테스트 코드 작성 | `TEST.md 진행해줘` |
| 코드 간결화 | `/simplify 하위 디렉토리 포함` |

---

## 14. 핵심 도메인 및 모듈 관계

### 14.1 백엔드 주요 도메인 (Spring Boot)

| 도메인 | 모듈 | 설명 |
|--------|------|------|
| **인증·보안** | `common/system` | JWT httpOnly 쿠키, 로그인 이력, Brute-force 보호 |
| **사용자·조직** | `common/iam` | RBAC, 자격등급, 역할 매핑 |
| **신청서·결재** | `common/approval` | 전자결재 프로세스, 상태 전이 |
| **공통 게시판** | `common/board` | 게시판 메타, 게시물, 댓글, 권한 검증 |
| **공통코드** | `common/code` | 코드 CRUD, 캐싱 |
| **정보화사업** | `budget/project` | 사업 CRUD, 복합키 (`prjYy` + `prjSn`) |
| **전산업무비** | `budget/cost` | 비용 항목, 단말기, 복합키 (`costYy` + `costSn`) |
| **요구사항·검토** | `budget/document` | 가이드 문서, 요구사항 정의서, 검토의견 |
| **정보기술부문 계획** | `budget/plan` | 계획 CRUD, JSON 스냅샷 |
| **협의회** | `council` | 신청, 타당성검토, 위원선정, 일정, 평가, 결과 (23 엔드포인트) |
| **감사로그** | `domain/log` | 자동 변경 로그 (23개 도메인 추적) |
| **파일·AI** | `infra/` | 첨부파일, Gemini API |

### 14.2 프론트엔드 주요 모듈 (Nuxt 4)

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
| **Tiptap 에디터** | `components/TiptapEditor.vue` | 리치 텍스트, 표, 이미지, 다이어그램, 수식 |
| **공통 게시판** | `composables/useBoard*.ts`, `pages/board/` | 게시판 메타, 게시물, 댓글 CRUD |
| **시스템 관리** | `pages/admin/`, `composables/useAdminApi.ts` | 공통코드, 사용자, 역할, 조직, 파일 관리 |

---

## 15. 인증 및 보안

### 15.1 JWT httpOnly 쿠키 인증

**로그인 흐름:**
1. 사번/비밀번호 제출 → `POST /api/auth/login`
2. 백엔드가 Access Token(15분) + Refresh Token(7일) 발급
3. `Set-Cookie` 헤더로 httpOnly 쿠키에 저장 (JavaScript 접근 불가)
4. 프론트엔드 `it-portal-user` 쿠키에 사용자 정보 저장 (UX용)

**API 요청:**
- 모든 인증 API는 `credentials: 'include'`로 쿠키 자동 전송
- `401 Unauthorized` 시 `refresh()` → 새 토큰 → 원요청 재시도

**주의:** 프론트엔드가 JWT 문자열을 직접 저장/읽지 않음 (XSS 방어)

### 15.2 관리자 접근 제어 (RBAC)

| 계층 | 기술 | 예시 |
|------|------|------|
| 클라이언트 | 라우트 가드 + Pinia | `middleware/admin.ts`, `user.value?.athIds?.includes(ROLE.ADMIN)` |
| 백엔드 URL | SecurityConfig | `/api/admin/**` URL 패턴 → `ROLE_ADMIN` 필수 |
| 백엔드 메서드 | @PreAuthorize | `@PreAuthorize("hasRole('ADMIN')")` 컨트롤러 클래스/메서드 |

---

## 16. 기타 프로젝트 스킬

| 스킬 | 용도 |
|------|------|
| `/fp` | 정통법 기능점수(FP) 산정 |

---

## 17. 주요 파일 및 참조

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

## 18. 개발 노트: 현재 코드베이스 구조

### 12.1 백엔드 모듈 관계

백엔드는 Spring Boot 4 기반 레이어드 구조입니다. `controller → service → repository → Oracle DB` 흐름을 유지하며, 복잡한 조회는 QueryDSL `RepositoryCustom`/`RepositoryImpl` 패턴으로 분리합니다.

| 영역 | 역할 | 주요 특징 |
|------|------|-----------|
| `common/system` | 인증, JWT, 로그인 이력 | httpOnly 쿠키 기반 Access/Refresh Token, `JwtAuthenticationFilter`에서 쿠키 우선 인증 |
| `common/iam` | 사용자, 조직, 자격등급 | `CuserI`, `CorgnI`, `CauthI`, `CroleI` 중심의 RBAC 기반 데이터 |
| `common/approval` | 전자결재 | 신청서 마스터와 원본 업무 객체 연결, 결재 완료 이벤트 발행 |
| `common/board` | 공통 게시판 | 게시판 메타, 게시물, 댓글, 답변글, 권한/부서 제한 정책 |
| `domain/budget` | 정보화 예산/사업 | project, cost, plan, work, status, document 하위 도메인으로 분리 |
| `domain/council` | 정보화실무협의회 | 심의과제, 평가위원, 타당성, 결과서, 일정 관리 |
| `domain/log` | 감사 로그 | JPA 엔티티 리스너 기반 변경 로그 인프라 |
| `infra/file`, `infra/ai` | 파일, Gemini 연동 | 업무 도메인과 분리된 외부 연동 계층 |

### 12.2 프론트엔드 모듈 관계

프론트엔드는 Nuxt 4의 `app/` 소스 루트를 사용합니다. 페이지는 업무 메뉴 구조를 따르고, 반복 API 호출은 `composables/`, 전역 인증/검토 상태는 `stores/`에서 관리합니다.

| 영역 | 역할 | 주요 특징 |
|------|------|-----------|
| `app/pages` | 라우트 화면 | admin, info, budget, approval, audit 등 업무 메뉴별 화면 |
| `app/components` | UI 조립 단위 | PrimeVue 기반 공통 테이블, 결재/사전협의/협의회 컴포넌트 |
| `app/composables` | API 및 화면 로직 | `useApiFetch`는 GET 조회, `$apiFetch`는 변경 요청에 사용. 게시판은 `useBoard*` 계열 사용 |
| `app/stores` | 전역 상태 | 인증 상태와 사전협의 세션 상태 관리 |
| `app/types` | 공유 타입 | 인증/RBAC, 예산작업, 협의회, 사전협의 타입 |
| `app/utils` | 순수 유틸 | 금액/상태 표시, Excel/HWPX/PDF 생성 보조 |

### 12.3 핵심 설계 결정

- 인증은 httpOnly 쿠키 방식입니다. 프론트엔드가 JWT 문자열을 직접 다루지 않고, 브라우저가 쿠키를 자동 전송합니다.
- Access Token의 기본 유효시간은 15분입니다. 백엔드 JWT 설정과 쿠키 Max-Age를 같은 시간으로 유지해야 합니다.
- 관리자 접근 제어는 프론트 라우트 가드와 백엔드 URL/메서드 권한 검사를 함께 사용합니다.
- `StyledDataTable`은 PrimeVue DataTable 스타일 차이를 흡수하는 표준 래퍼입니다. 신규 목록 화면은 이 컴포넌트를 우선 사용합니다.
- 사전협의 검토 세션은 일부 UI 상태가 아직 메모리/모의 데이터에 의존합니다. 서버 영속화와 프로젝트별 검토자 조회는 `TASK.md`의 후속 과제로 관리합니다.
- 공통 게시판은 `/board/**` 사용자 화면과 `/admin/boards` 관리자 화면으로 구성됩니다. 프론트 메뉴 필터는 UX 보조이며, 최종 권한은 백엔드 게시판 서비스에서 검증합니다.

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
- 로그인 Brute-force 보호 설명을 실제 구현에 맞게 수정했습니다. 현재는 인메모리 카운터가 아니라 `TAAABB_CLOGNH` 로그인 실패 이력을 집계합니다.
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

- 실제 실행 설정 기준으로 로컬 개발 URL을 프론트엔드 `http://localhost:3000`, 백엔드 `http://localhost:8080`로 정정했습니다.
- `EnvironmentValidator`는 `spring.datasource.password`, `jwt.secret`의 해석 결과가 빈값일 때만 기동을 차단합니다. 현재 `application.properties`에는 `DB_PASSWORD`, `JWT_SECRET` 기본값이 남아 있어 기본값 제거 과제를 `TASK.md`에 다시 열어두었습니다.
- `FileOwnershipChecker`, `FileValidator`, `LoginAttemptService`, `GeminiController` 관리자 제한은 코드에 반영된 상태로 확인했습니다.
- 프론트엔드 `ReviewVersionHistory.vue`의 로컬 `formatDateTime`은 버전 이력 전용 축약 포맷으로 주석을 명확히 했고, 전체 화면 표준 포맷은 `utils/common.ts` 사용 규칙을 유지합니다.

### 12.5 2026-05-06 정비 메모

- 실제 운영 소스 기준으로 Java 199개, TypeScript 61개, Vue 113개를 다시 스캔했습니다.
- 백엔드 인증 설정 문서의 JWT 키명을 실제 `application.properties`의 `jwt.access-token-validity`, `jwt.refresh-token-validity`와 맞췄습니다.
- 프론트엔드 인증 규칙을 재확인했습니다. 토큰은 여전히 httpOnly 쿠키로만 전달하며, `localStorage`는 컬럼 표시 설정과 구버전 사용자 쿠키 마이그레이션에만 사용됩니다.
- 사전협의 코멘트 흐름은 `ReviewCommentController`/`ReviewCommentService`가 `BRIVGM` 조회·생성·해결을 담당하고, 프론트 `useReviewCommentApi`가 UI 타입으로 변환합니다.
- 사전협의 검토자 목록, 작성자 팀명, 첨부파일 매핑은 아직 후속 구현 대상입니다. 관련 항목은 루트 `TASK.md`에서 추적합니다.
- 개발용 `application.properties`에 Oracle 비밀번호와 JWT 시크릿 기본값이 남아 있습니다. 운영 배포 전 환경변수 또는 비공개 프로파일 분리가 필요합니다.
