---
[ 프로젝트 메인 가이드 ]
본 파일은 IT Portal System의 개발 환경, 기술 스택, 코딩 표준을 정의합니다.
AI 어시스턴트는 코드 생성 시 이 지침을 준수하며, 모든 주석은 한글로 작성합니다.
---

## 1. 프로젝트 개요
- 명칭: IT Portal (IT 정보화 포탈)
- 주요 기능: 정보화 예산, 사업, 인력 관리
- 사용자: 약 3,000명의 사내 임직원 

## 2. 디렉토리 구조
```
it
├── it_frontend 프론트엔드
├── it_backend  백엔드
└── it_database DB 스크립트/마이그레이션
```

## 3. 기술 스택 (Tech Stack)
각 디렉토리에 있는 CLAUDE.md 파일을 참조하세요.

## 4. 개발 환경

### 4.1 로컬 서버 URL
| 서비스 | URL |
|--------|-----|
| 프론트엔드 | http://localhost:3000 |
| 백엔드 API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui/index.html |
| Oracle DB | 127.0.0.1:1521/XEPDB1 |

### 4.2 서버 시작
```bash
# 백엔드 (it_backend 디렉토리)
./gradlew bootRun

# 프론트엔드 (it_frontend 디렉토리)
npm run dev
```

### 4.3 로컬 DB 접속
```powershell
# 루트 디렉토리에서 실행
.\it_database\connect-db.ps1

# cmd.exe 환경에서는 배치 래퍼 사용 가능
.\it_database\connect-db.bat
```

- 기본 계정: `ITPAPP`
- 기본 서비스: `127.0.0.1:1521/XEPDB1`
- DB 확인이 필요할 때는 위 스크립트로 접속합니다.
- 접속 클라이언트는 `sqlplus`를 우선 사용하고, 없으면 SQLcl의 `sql` 명령을 사용합니다.

## 5. AI 하네스 가이드

### 5.1 bkit PDCA
- 현재 진행 피처: **rbac** (design 페이즈)
- 새 피처 시작: `/pdca plan {피처명}`
- 상태 확인: `/pdca status`
- 다음 단계 확인: `/pdca next`


### 5.2 gstack QA 워크플로우
두 서버(`./gradlew bootRun` + `npm run dev`)를 모두 기동한 뒤 `/qa`로 브라우저 기반 테스트를 수행합니다.

- 테스트 대상: http://localhost:3000
- API 서버: http://localhost:8080
- 핵심 테스트 시나리오: 로그인, 프로젝트 조회/생성, 결재 처리

### 5.3 gstack 주요 스킬
| 스킬 | 용도 |
|------|------|
| `/qa` | 화면 기능 테스트 (브라우저 자동화) |
| `/investigate` | 버그·오류 원인 분석 |
| `/review` | 코드 리뷰 (diff 기준) |
| `/ship` | PR 생성 및 배포 |
| `/health` | 코드 품질 점검 |
| `/checkpoint` | 작업 중간 저장 및 복원 |

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

## Health Stack

- typecheck: cd it_frontend && npx nuxt typecheck
- lint: cd it_frontend && npx eslint .
- test-frontend: cd it_frontend && npx vitest run
- test-backend: cd it_backend && ./gradlew test

## 6. 공통 코드 컨벤션 보강

### 6.1 주석 기준
- 모든 신규 주석은 한글로 작성하며, 코드가 이미 명확한 단순 대입에는 주석을 추가하지 않습니다.
- 파일 헤더 주석은 해당 파일의 역할, 주요 흐름, 연동 대상 API 또는 테이블을 설명합니다.
- public API, service 메서드, composable 반환 함수에는 입력값과 실패 조건을 함께 기록합니다.
- TODO/FIXME는 반드시 후속 조치가 가능한 문장으로 남기고, 장기 과제는 루트 `TASK.md`에도 등록합니다.

### 6.2 인증/보안 기준
- 프론트엔드는 JWT를 직접 저장하지 않습니다. Access Token과 Refresh Token은 백엔드가 발급하는 httpOnly 쿠키로만 전달합니다.
- 인증 API 호출은 `credentials: 'include'`를 유지합니다.
- Access Token 기본 유효시간은 15분이며, 쿠키 Max-Age와 `jwt.access-token-validity`가 어긋나지 않도록 관리합니다.
- 관리자 권한은 프론트 라우트 가드와 백엔드 `SecurityConfig`/`@PreAuthorize`를 함께 적용합니다.

### 6.3 문서 최신화 기준
- `README.md`는 신규 개발자가 흐름을 파악하는 개발 노트로 유지합니다.
- `CLAUDE.md`는 실제 코드에서 확인된 규칙만 기록합니다.
- `TASK.md`는 미구현, 기술 부채, 보안/성능/테스트 보강 과제를 한곳에서 관리합니다.

## 하네스: IT Portal 에이전트 팀

**목표:** 백엔드(Spring Boot 4) + 프론트(Nuxt 4) + 보안(RBAC) + QA를 에이전트 팀으로 분담하여 end-to-end 구현

**트리거:** 새 기능 개발, API/UI 구현, RBAC 설계·검증, QA 실행 요청 시 `it-portal` 스킬을 사용하라.

**에이전트 목록:**
- `.claude/agents/backend-dev.md` — Spring Boot API
- `.claude/agents/frontend-dev.md` — Nuxt 4 UI
- `.claude/agents/security-rbac.md` — RBAC 설계·검증
- `.claude/agents/qa-reviewer.md` — QA + 코드리뷰

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-19 | 초기 구성 | 전체 | IT Portal 도메인 전용 에이전트 팀 구축 |
