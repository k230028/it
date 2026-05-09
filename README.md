# 개발 노트 (Development Notes)

## 1. 시스템 개요

IT Project Portal (IT 정보화 포탈)은 정보화 예산, 사업, 인력을 관리하는 내부 업무 시스템입니다.

- **사용자:** 약 3,000명의 사내 임직원
- **프론트엔드:** Nuxt 4 + PrimeVue + Tailwind CSS
- **백엔드:** Spring Boot + Oracle DB + JPA/QueryDSL

---

## 2. AI 하네스 구성

본 프로젝트는 4개의 AI 도구를 조합한 **Agentic Engineering 하네스**를 사용합니다.

```
┌─────────────────────────────────────────────────────────┐
│  gstack      — 브라우저 QA·리뷰·배포 슬래시 명령어          │
│  bkit PDCA   — 피처 단위 계획→실행→검증 워크플로우          │
│  ECC         — 스프링부트·Nuxt 패턴 스킬 라이브러리         │
│  Superpowers — 계획·디버깅·TDD 메타 워크플로우 스킬         │
└─────────────────────────────────────────────────────────┘
```

---
## 3. gstack — 브라우저 기반 운영 명령어

gstack은 **슬래시 명령어 형태의 전문가 팀**입니다. 두 서버가 모두 기동된 상태에서 사용합니다.

```bash
# 서버 기동 (각각 별도 터미널)
cd it_backend  && ./gradlew bootRun
cd it_frontend && npm run dev
```
### 3.1 핵심 명령어

| 명령어 | 용도 | 사용 시점 |
|--------|------|-----------|
| `/qa` | 브라우저 자동화 품질 테스트 | 기능 구현 완료 후 |
| `/investigate` | 버그·500 오류 원인 분석 | 에러 발생 시 |
| `/review` | git diff 기준 코드 리뷰 | 커밋 전 |
| `/ship` | PR 생성 및 배포 | 배포 준비 완료 시 |
| `/health` | 코드 품질 전반 점검 | 주기적 품질 관리 |
| `/checkpoint` | 작업 상태 저장·복원 | 긴 작업 중간 저장 |
### 3.2 핵심 테스트 시나리오 (`/qa`)

- 테스트 결과 파일 위치: `it\.gstack\qa-reports`

---
## 4. bkit PDCA — 피처 단위 구조화 개발

bkit은 **PDCA 방법론 기반 피처 개발 워크플로우**입니다. 계획→설계→실행→검증→아카이브 순으로 진행합니다.

### 4.1 기본 명령어

```bash
/pdca plan {기능 요구사항}    # 새 피처 시작 (계획 단계)
/pdca status                  # 현재 진행 상태 확인
/pdca next                    # 다음 단계로 이동
```

### 4.2 피처 진행 단계

```
plan → design → do → analysis → archive
 계획     설계    실행    검증       아카이브
```

### 4.3 생성 문서 위치

| 문서 | 경로 |
|------|------|
| 계획서 | `docs/01-plan/features/{feature}.plan.md` |
| 설계서 | `docs/02-design/features/{feature}.design.md` |
| 보고서 | `docs/04-report/{feature}.report.md` |
| 상태 파일 | `.bkit/state/pdca-status.json` |

---

## 5. ECC (Everything Claude Code) — 패턴 스킬 라이브러리

ECC는 **프레임워크별 Best Practice 스킬 모음**입니다 (v1.10.0). IT Portal에 직접 연관된 스킬:

### 5.1 백엔드 (Spring Boot)

```bash
/springboot-patterns       # 레이어드 아키텍처, JPA, 예외처리 패턴
/springboot-tdd            # Spring Boot TDD 워크플로우
/springboot-verification   # 구현 완료 후 검증 체크리스트
/springboot-security       # Spring Security, JWT, RBAC 패턴
/backend-patterns          # API 설계, 페이지네이션, 캐싱
/api-design                # REST API 설계 원칙
```

### 5.2 프론트엔드 (Nuxt 4)

```bash
/nuxt4-patterns            # Nuxt 4 컴포저블, 상태관리, 라우팅 패턴
/frontend-design           # UI/UX 컴포넌트 설계 원칙
/frontend-patterns         # Vue 3 Composition API 패턴
```

### 5.3 품질·보안

```bash
/tdd-workflow              # TDD 실천 워크플로우
/security-review           # OWASP Top 10, 보안 취약점 스캔
/plankton-code-quality     # 코드 품질 종합 분석
```

---

## 6. Superpowers — 메타 워크플로우 스킬

Superpowers는 **개발 방법론 수준의 워크플로우 스킬**입니다 (v5.0.7). 특정 작업 전 AI의 접근 방식 자체를 정의합니다.

| 스킬 | 용도 | 사용 시점 |
|------|------|-----------|
| `/brainstorm` | 아이디어 구체화·탐색 | 기능 구상 단계 |
| `/write-plan` | 구조화된 구현 계획 작성 | 복잡한 기능 착수 전 |
| `/execute-plan` | 작성된 계획 단계별 실행 | 계획 수립 후 |
| `/systematic-debugging` | 체계적 디버깅 워크플로우 | 원인 불명 버그 |
| `/test-driven-development` | TDD 강제 워크플로우 | 새 기능·버그픽스 |
| `/verification-before-completion` | 완료 전 최종 검증 | PR 생성 직전 |

---

## 7. IT Portal 에이전트 팀

에이전트는 `~/.claude/agents/`에 설치된 ECC 전문가 에이전트입니다.  
Claude가 상황에 따라 자동으로 활성화하거나, 요청 시 서브에이전트로 직접 호출합니다.

### 7.1 백엔드 (Spring Boot 4 · Java 25 · Oracle · JPA/QueryDSL)

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `java-reviewer` | 레이어드 아키텍처·JPA 패턴·트랜잭션·동시성 리뷰 | Controller/Service/Repository 수정 후 |
| `java-build-resolver` | Gradle 빌드·컴파일·의존성 에러 수정 | `./gradlew build` 실패 시 |
| `database-reviewer` | JPA 엔티티·QueryDSL 쿼리·N+1·인덱스 설계 리뷰 | 쿼리·스키마 변경 시 |
| `security-reviewer` | JWT·Spring Security·RBAC·OWASP Top 10 취약점 스캔 | 인증/인가 코드 변경 전 커밋 |

### 7.2 프론트엔드 (Nuxt 4 · TypeScript · Vue 3 · PrimeVue · Pinia)

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `typescript-reviewer` | 타입 안전성·`useApiFetch`·`$apiFetch` 패턴·Composable 구조 리뷰 | `.vue`·`.ts` 수정 후 |
| `e2e-runner` | Playwright 기반 E2E 시나리오 생성·실행·유지 | 화면 기능 구현 완료 후 |
| `build-error-resolver` | TypeScript·Nuxt 빌드 오류 수정 | `npx nuxt typecheck` 실패 시 |

### 7.3 품질 · 보안

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `code-reviewer` | 풀스택 코드 품질·가독성·패턴 리뷰 | 모든 코드 변경 후 (자동 활성화) |
| `silent-failure-hunter` | 에러 삼킴·빈 catch·누락된 에러 전파 탐지 | 서비스·컨트롤러 신규 작성 시 |
| `pr-test-analyzer` | PR 테스트 커버리지·행동 커버리지 평가 | PR 생성 전 |
| `tdd-guide` | 테스트 먼저 작성(RED→GREEN→IMPROVE) 워크플로우 강제 | 새 기능·버그픽스 착수 시 |

### 7.4 계획 · 설계

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `planner` | 구현 청사진·파일·인터페이스·빌드 순서 설계 | 복잡한 기능 착수 전 |
| `code-architect` | 기존 패턴 분석 기반 기능 아키텍처 설계 | 신규 도메인 추가 시 |
| `architect` | 시스템 확장성·기술 결정 분석 | 아키텍처 변경 검토 시 |
| `performance-optimizer` | 쿼리·번들·렌더링 병목 분석·최적화 | 성능 이슈 발생 시 |

### 7.5 문서 · 유지보수

| 에이전트 | 주요 역할 | 사용 시점 |
|---------|---------|---------|
| `doc-updater` | CLAUDE.md·README·가이드 문서 동기화 | 코드 구조 변경 후 |
| `refactor-cleaner` | 미사용 코드·중복·dead import 정리 | 주기적 코드 정비 시 |
| `code-simplifier` | 최근 변경 코드 간결화·일관성 개선 | 기능 구현 완료 직후 |

---

## 8. 워크플로우 가이드

### 8.1 새 기능 개발 (풀스택)

**필수 단계** — 매 기능마다 실행:
```
1. /brainstorm {기능 아이디어}       ← Superpowers: 기능 구체화
2. /pdca plan {기능 요구사항}        ← bkit: 계획 수립
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

### 8.2 버그 수정

```
1. /investigate                     ← gstack: 원인 분석
2. /systematic-debugging            ← Superpowers: 체계적 디버깅
3. /test-driven-development         ← Superpowers: 테스트 먼저 작성
4. /qa                              ← gstack: 회귀 테스트
```

### 8.3 코드 품질 점검

```
1. /health                          ← gstack: 전반적 품질
2. /security-review                 ← ECC: 보안 취약점
3. /plankton-code-quality           ← ECC: 코드 품질 분석
```

### 8.4 정기 정비

| 작업 | 시작 방법 |
|------|-----------|
| 전체 코드·구조 정비 | `REVIEW.md 진행해줘` |
| 테스트 코드 작성 | `TEST.md 진행해줘` |
| 코드 간결화 | `/simplify 하위 디렉토리 포함` |

---

## 9. Health Stack (빠른 품질 확인)

```bash
# 타입 체크
cd it_frontend && npx nuxt typecheck

# 린트
cd it_frontend && npx eslint .

# 프론트엔드 단위 테스트
cd it_frontend && npx vitest run

# 백엔드 테스트
cd it_backend && ./gradlew test
cd it_backend && .\gradlew test jacocoTestReport


```

---

## 10. 기타 프로젝트 스킬

| 스킬 | 용도 |
|------|------|
| `/fp` | 정통법 기능점수(FP) 산정 |

---

## 11. 개발 노트: 현재 코드베이스 구조

### 11.1 백엔드 모듈 관계

백엔드는 Spring Boot 4 기반 레이어드 구조입니다. `controller → service → repository → Oracle DB` 흐름을 유지하며, 복잡한 조회는 QueryDSL `RepositoryCustom`/`RepositoryImpl` 패턴으로 분리합니다.

| 영역 | 역할 | 주요 특징 |
|------|------|-----------|
| `common/system` | 인증, JWT, 로그인 이력 | httpOnly 쿠키 기반 Access/Refresh Token, `JwtAuthenticationFilter`에서 쿠키 우선 인증 |
| `common/iam` | 사용자, 조직, 자격등급 | `CuserI`, `CorgnI`, `CauthI`, `CroleI` 중심의 RBAC 기반 데이터 |
| `common/approval` | 전자결재 | 신청서 마스터와 원본 업무 객체 연결, 결재 완료 이벤트 발행 |
| `domain/budget` | 정보화 예산/사업 | project, cost, plan, work, status, document 하위 도메인으로 분리 |
| `domain/council` | 정보화실무협의회 | 심의과제, 평가위원, 타당성, 결과서, 일정 관리 |
| `domain/log` | 감사 로그 | JPA 엔티티 리스너 기반 변경 로그 인프라 |
| `infra/file`, `infra/ai` | 파일, Gemini 연동 | 업무 도메인과 분리된 외부 연동 계층 |

### 11.2 프론트엔드 모듈 관계

프론트엔드는 Nuxt 4의 `app/` 소스 루트를 사용합니다. 페이지는 업무 메뉴 구조를 따르고, 반복 API 호출은 `composables/`, 전역 인증/검토 상태는 `stores/`에서 관리합니다.

| 영역 | 역할 | 주요 특징 |
|------|------|-----------|
| `app/pages` | 라우트 화면 | admin, info, budget, approval, audit 등 업무 메뉴별 화면 |
| `app/components` | UI 조립 단위 | PrimeVue 기반 공통 테이블, 결재/사전협의/협의회 컴포넌트 |
| `app/composables` | API 및 화면 로직 | `useApiFetch`는 GET 조회, `$apiFetch`는 변경 요청에 사용 |
| `app/stores` | 전역 상태 | 인증 상태와 사전협의 세션 상태 관리 |
| `app/types` | 공유 타입 | 인증/RBAC, 예산작업, 협의회, 사전협의 타입 |
| `app/utils` | 순수 유틸 | 금액/상태 표시, Excel/HWPX/PDF 생성 보조 |

### 11.3 핵심 설계 결정

- 인증은 httpOnly 쿠키 방식입니다. 프론트엔드가 JWT 문자열을 직접 다루지 않고, 브라우저가 쿠키를 자동 전송합니다.
- Access Token의 기본 유효시간은 15분입니다. 백엔드 JWT 설정과 쿠키 Max-Age를 같은 시간으로 유지해야 합니다.
- 관리자 접근 제어는 프론트 라우트 가드와 백엔드 URL/메서드 권한 검사를 함께 사용합니다.
- `StyledDataTable`은 PrimeVue DataTable 스타일 차이를 흡수하는 표준 래퍼입니다. 신규 목록 화면은 이 컴포넌트를 우선 사용합니다.
- 사전협의 검토 세션은 일부 UI 상태가 아직 메모리/모의 데이터에 의존합니다. 서버 영속화와 프로젝트별 검토자 조회는 `TASK.md`의 후속 과제로 관리합니다.

### 11.4 2026-04-29 정비 메모

- 실제 소스 기준으로 백엔드 194개, 프론트엔드 앱 146개 내외의 Java/TypeScript/Vue 파일을 점검했습니다.
- 인증 주석 중 Authorization 헤더/localStorage 중심으로 남아 있던 설명을 httpOnly 쿠키 방식에 맞게 수정했습니다.
- Access Token 쿠키 만료 시간을 JWT 설정의 15분과 맞추고, `CookieUtilTest`로 회귀 검증을 추가했습니다.
- 루트 `TASK.md`가 없어 신규 백로그 파일을 생성했습니다.

### 11.6 2026-05-09 정비 메모

- REVIEW.md 전면 실행: java-reviewer·typescript-reviewer·silent-failure-hunter·security-reviewer·refactor-cleaner·database-reviewer 총 6개 에이전트 병렬 분석.
- **주석 정비**: Java 30개 파일·TypeScript/Vue 40개 파일 오류 주석 교정·누락 JavaDoc/TSDoc 추가, 에러 삼킴 30개 위치에 TODO/FIXME 한글 주석 삽입.
- **보안 이슈 발굴**: `application.properties` 비밀값 기본값 하드코딩(Critical), SHA-256 무염 비밀번호 해시(High), RBAC 미적용 컨트롤러 다수(High), 파일 업로드 확장자 미검증(High), Brute-force 보호 없음(High) — `it_backend/CLAUDE.md §5.6`에 반영, `TASK.md`에 등록.
- **DB/JPA 이슈**: `BudgetWorkService` N+1 3건, `CAPPLA`/`BITEMM` 인덱스 미확인, `Bprojm.update()` 35+ 파라미터, `ProjectRepositoryImpl`/`CostRepositoryImpl` 전체 컬럼 SELECT 등 — `TASK.md`에 등록.
- **프론트엔드 리팩토링**: `ApplicationViewerDialog` 빈 쉘, `formatDateTime` 3벌 불일치 구현, `alert()` UX 불일치 등 — `TASK.md`에 등록.
- `it_backend/README.md`·`it_frontend/README.md` 전면 재작성 (설계 결정 이유, API 맵, 보안 흐름, 환경 설정 포함).

### 11.5 2026-05-06 정비 메모

- 실제 운영 소스 기준으로 Java 199개, TypeScript 61개, Vue 113개를 다시 스캔했습니다.
- 백엔드 인증 설정 문서의 JWT 키명을 실제 `application.properties`의 `jwt.access-token-validity`, `jwt.refresh-token-validity`와 맞췄습니다.
- 프론트엔드 인증 규칙을 재확인했습니다. 토큰은 여전히 httpOnly 쿠키로만 전달하며, `localStorage`는 컬럼 표시 설정과 구버전 사용자 쿠키 마이그레이션에만 사용됩니다.
- 사전협의 코멘트 흐름은 `ReviewCommentController`/`ReviewCommentService`가 `BRIVGM` 조회·생성·해결을 담당하고, 프론트 `useReviewCommentApi`가 UI 타입으로 변환합니다.
- 사전협의 검토자 목록, 작성자 팀명, 첨부파일 매핑은 아직 후속 구현 대상입니다. 관련 항목은 루트 `TASK.md`에서 추적합니다.
- 개발용 `application.properties`에 Oracle 비밀번호와 JWT 시크릿 기본값이 남아 있습니다. 운영 배포 전 환경변수 또는 비공개 프로파일 분리가 필요합니다.
