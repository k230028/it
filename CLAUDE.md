---
[ 프로젝트 메인 가이드 ]
본 파일은 IT Portal의 진입점입니다. 공통 운영 규약과 각 하위 프로젝트(`it_backend`, `it_frontend`)의 CLAUDE.md 포인터를 정의합니다.
AI 어시스턴트는 코드 생성 시 모든 주석을 한글로 작성합니다.
---

## 1. 프로젝트 개요
- 명칭: IT Portal (IT 정보화 포탈)
- 주요 기능: 정보화 예산, 사업, 인력 관리
- 사용자: 약 3,000명의 사내 임직원

## 2. 디렉토리 구조 및 SoT 분배

```
it/
├── it_frontend/        ← Nuxt 4 (UI). 상세는 it_frontend/CLAUDE.md
├── it_backend/         ← Spring Boot (API). 상세는 it_backend/CLAUDE.md
├── it_database/        ← DDL/시드/마이그레이션
├── docs/               ← PDCA 문서 (01-plan ~ 04-report, archive)
└── TASK.md             ← 미구현/기술부채/장기 과제
```

각 영역의 단일 진실 공급원(Single Source of Truth):

| 토픽 | SoT |
|------|-----|
| 백엔드 기술 스택 / API 설계 / 엔티티 / 인증 정책 / 운영 비밀값 기준 | `it_backend/CLAUDE.md` |
| 프론트엔드 기술 스택 / 컴포넌트 / 라우팅 / 클라이언트 인증 책임 | `it_frontend/CLAUDE.md` |
| 데이터 모델 (테이블 매핑) | `it_backend/docs/guides/data-model.md` |
| 컴포넌트 가이드 (StyledDataTable 등) | `it_frontend/docs/guides/` |

## 3. 개발 환경

| 서비스 | URL | 시작 명령 |
|--------|-----|----------|
| 프론트엔드 | http://localhost:3000 | `cd it_frontend && npm run dev` |
| 백엔드 API | http://localhost:8080 | `cd it_backend && ./gradlew bootRun` |
| Swagger UI | http://localhost:8080/swagger-ui/index.html | (백엔드 기동 후) |

## 4. 공통 운영 규약 (모든 하위 프로젝트 적용)

### 4.1 한글 주석 원칙
- 모든 신규 주석(JavaDoc/TSDoc/인라인)은 한글.
- 단순 대입·트리비얼 메서드에는 주석을 추가하지 않습니다.
- public API, service 메서드, composable 반환 함수에는 입력값과 실패 조건을 함께 기록합니다.
- TODO/FIXME는 후속 조치가 가능한 문장으로 작성. 장기 과제는 `TASK.md`에 등록.

### 4.2 인증 / 보안 (요약)
- JWT는 백엔드가 발급하는 **httpOnly 쿠키**로만 전달. 프론트엔드는 토큰을 직접 저장/읽지 않습니다.
- 인증 API 호출은 `credentials: 'include'`.
- Access Token 15분 / Refresh Token 7일 (백엔드 SoT).
- 관리자 권한은 프론트 라우트 가드 + 백엔드 `SecurityConfig`/`@PreAuthorize` 이중 적용.
- DB 비밀번호, JWT 시크릿, 외부 API 키는 운영 배포 시 환경변수 또는 비공개 프로파일에서 주입합니다.
- 상세 정책은 `it_backend/CLAUDE.md` 인증 섹션을 SoT로 따릅니다.

### 4.3 문서 관리
- `README.md` — 신규 개발자가 흐름을 파악하는 개발 노트
- `CLAUDE.md` — 실제 코드에서 확인된 규칙만 기록 (휘발성/카운트 정보 금지)
- `TASK.md` — 미구현, 기술 부채, 보안/성능/테스트 보강 과제

## 5. AI 하네스 가이드

### 5.1 bkit PDCA
- 새 피처 시작: `/pdca plan {피처명}`
- 상태 확인: `/pdca status`
- 다음 단계 확인: `/pdca next`
- (현재 진행 피처는 `/pdca status`로 조회 — CLAUDE.md에 박지 않음)

### 5.2 QA 워크플로우
두 서버를 모두 기동한 뒤 `/qa`로 브라우저 기반 테스트를 수행합니다.
- 테스트 대상: http://localhost:3000
- API 서버: http://localhost:8080
- 핵심 시나리오: 로그인, 프로젝트 조회/생성, 결재 처리

### 5.3 주요 스킬
| 스킬 | 용도 |
|------|------|
| `/qa` | 화면 기능 테스트 (브라우저 자동화) |
| `/investigate` | 버그·오류 원인 분석 |
| `/review` | 코드 리뷰 (diff 기준) |
| `/ship` | PR 생성 및 배포 |
| `/health` | 코드 품질 점검 |
| `/checkpoint` | 작업 중간 저장 및 복원 |

### 5.4 IT Portal 에이전트 팀
새 기능 개발, API/UI 구현, RBAC 설계·검증, QA 실행 요청 시 `it-portal` 스킬을 사용합니다.

| 에이전트 | 역할 |
|---------|------|
| `.claude/agents/backend-dev.md` | Spring Boot API |
| `.claude/agents/frontend-dev.md` | Nuxt 4 UI |
| `.claude/agents/security-rbac.md` | RBAC 설계·검증 |
| `.claude/agents/qa-reviewer.md` | QA + 코드리뷰 |

## 6. Health Stack

| 명령 | 디렉토리 | 용도 |
|------|---------|------|
| `npx nuxt typecheck` | `it_frontend` | 타입 체크 |
| `npx eslint .` | `it_frontend` | 린트 |
| `npx vitest run` | `it_frontend` | 프론트 단위 테스트 |
| `./gradlew test` | `it_backend` | 백엔드 테스트 |
