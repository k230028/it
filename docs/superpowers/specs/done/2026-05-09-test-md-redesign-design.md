# TEST.md 재설계 — Agent 오케스트레이션 구조화

**날짜:** 2026-05-09  
**목적:** TEST.md를 REVIEW.md 수준의 에이전트 오케스트레이션 스펙으로 재설계하여 agents·team·rule·skill을 종합적으로 활용할 수 있도록 구조화한다.

---

## 1. 배경 및 문제 정의

### 현재 상태 (AS-IS)

TEST.md는 목표(커버리지 70%+, E2E 시나리오 2개)와 대상 디렉토리만 나열된 내러티브 지침서다.

- 스킬이 나열되어 있지만 어떤 Task에서 언제 사용하는지 명시되지 않음
- 병렬/순차 실행 구조 없음
- 에이전트 역할 분담 없음
- 검증 루프가 "반복한다"는 서술로만 표현됨
- Task 간 결과 전달 방식 미정의

### 목표 상태 (TO-BE)

REVIEW.md와 동일한 구조 언어를 사용하는 오케스트레이션 스펙.  
Claude가 파일을 읽으면 바로 병렬 서브에이전트를 실행할 수 있는 수준.

---

## 2. 우선순위

| 순위 | 목표 |
|------|------|
| 1 | 커버리지 갭 분석 → 기존 파일 보강 |
| 2 | 테스트 없는 신규 도메인 커버 |
| 3 | E2E 시나리오 보강 (기존 개선 + 누락 발굴) |

---

## 3. 커버리지 목표 (변경 없음)

| 플랫폼 | 도구 | 지표 | 기준 |
|--------|------|------|------|
| Frontend | Vitest | Statements / Branches / Functions / Lines | 각 **70%** 이상 |
| Backend | JUnit + Jacoco | Branches / Instructions / Cyclomatic Complexity / Lines / Methods / Classes | 각 **70%** 이상 |
| E2E | Playwright | 정의된 시나리오 | **100%** 성공 |

---

## 4. Task 구조 설계

### 4.1 Task 1 — Coverage Gap Analysis

**목적:** 이후 Task들에 명확한 타겟을 제공하기 위해 갭 파일 목록을 먼저 생성한다.

| 에이전트 | 담당 범위 | 출력 |
|---------|---------|------|
| `java-reviewer` | `it_backend` 전체 `.java` | 클래스별 Jacoco 70% 미달 파일 목록 |
| `typescript-reviewer` | `it_frontend` 전체 `.ts`·`.vue` | 파일별 Vitest 70% 미달 목록 |
| `code-analyzer` | 전체 소스 | 테스트 없는 service·composable + 분기 미커버 코드 경로 |

**통합 (순차):** 3개 결과 병합 → `[BE 갭 파일 목록]` / `[FE 갭 파일 목록]`으로 분류, Task 2/3 실행 전 인라인 메모로 전달.

### 4.2 Task 2 — Unit Test 보강

**목적:** Task 1에서 발굴된 기존 파일의 커버리지 갭을 채운다.

| 에이전트 | 담당 | 참조 스킬 |
|---------|------|---------|
| `tdd-guide` (BE) | BE 갭 파일 → JUnit 5 / Mockito 테스트 작성 | `/springboot-tdd` |
| `tdd-guide` (FE) | FE 갭 파일 → Vitest 테스트 작성 (`vi.stubGlobal` 패턴) | — |

**규칙:**
- `it_frontend/CLAUDE.md §4.10` Mock 규칙 준수 (`vi.stubGlobal`, `Object.assign(process, {client:true})`)
- `it_backend/CLAUDE.md §5.5` 트랜잭션·JPA Dirty Checking 패턴 이해 후 테스트 작성
- 테스트 파일 위치: `tests/unit/composables/*.test.ts`, `src/test/java/com/kdb/it/**/*Test.java`

### 4.3 Task 3 — 신규 도메인 테스트

**목적:** 테스트 파일 자체가 없는 도메인을 발굴하여 테스트 피라미드의 빈 층을 채운다.

| 에이전트 | 담당 |
|---------|------|
| `java-reviewer` | 테스트 없는 서비스·컨트롤러 발굴 → 신규 JUnit 테스트 작성 |
| `typescript-reviewer` | 테스트 없는 composable·페이지 발굴 → 신규 Vitest 테스트 작성 |

**규칙:** AAA(Arrange-Act-Assert) 패턴 필수. 성공/실패/엣지 케이스 3종 이상.

### 4.4 Task 4 — E2E Test

**목적:** 정의된 2개 시나리오의 완성도를 높이고, 누락된 플로우를 발굴하여 spec으로 추가한다.

| 에이전트 | 담당 |
|---------|------|
| `e2e-runner` | 기존 2개 시나리오 완성도 확인·개선 + 미정의 시나리오 갭 탐지 → Playwright spec 작성/보강 |
| `qa-lead` | `/qa` 스킬로 실제 브라우저 기반 동작 검증 (http://localhost:13000) → 성공/실패 + 개선 포인트 리포트 |

**통합 (순차):** e2e-runner 신규 시나리오 + qa-lead 리포트 교차 검토. 실패 항목은 수정 후 재실행.

**기존 E2E 시나리오 (유지·개선 대상):**
1. 사전협의 목록 → 신규 작성(다이어그램·스크린샷·수식·파일첨부) → 저장 → 목록 확인 → 상세 문서 확인
2. 예산작성 → 정보화사업 → 전산업무비 → 경상사업 → 결재 상신 → 결재 → 예산 목록 확인

**발굴 대상 누락 시나리오 (예시):**
- 로그인 / 로그아웃 / 토큰 만료 흐름
- 관리자 페이지 접근 제어 (비관리자 차단)
- 파일 업로드·다운로드
- 권한별 메뉴 노출 차이

---

## 5. 검증 루프 — 하이브리드

### 1단계: 실질 측정 (Bash)

```bash
# 백엔드 — build/reports/jacoco 파싱
cd it_backend && ./gradlew test jacocoTestReport

# 프론트엔드 — coverage/ 파싱
cd it_frontend && npm run test:coverage

# E2E
cd it_frontend && npm run test:e2e
```

### 2단계: 코드리뷰

`qa-lead` — 70% 미달 파일 테스트 코드 검토, 누락 케이스 및 Mock 오류 지적

### 반복 조건

미달 파일 존재 시 → Task 2 또는 3 해당 에이전트만 재실행 → 검증 반복  
**종료:** 전체 파일 70%+ AND E2E 100% 성공

---

## 6. 기본 지침 (정리)

| 항목 | 내용 |
|------|------|
| 속도 vs 정확도 | 정확도 우선 |
| 인코딩 | UTF-8 유지 |
| 비즈니스 로직 | **절대 수정하지 않는다** |
| 주석 | CLAUDE.md §4.1 한글 주석 원칙 |
| 최우선 참조 | 루트 CLAUDE.md → it_backend/CLAUDE.md → it_frontend/CLAUDE.md |
| 자율 실행 | 모든 계획과 CLI 명령 확인 없이 진행 |
| Persona | 프로젝트 테스트 코드를 작성·개선하는 Senior Software Engineer |

---

## 7. 사용 스킬 (Task별 매핑)

| Task | 스킬 |
|------|------|
| Task 2 (BE) | `/springboot-tdd` |
| Task 4 (E2E) | `/qa` (qa-lead가 실행) |

---

## 8. 제거 항목

현재 TEST.md에서 삭제할 항목:
- `## 사용 스킬` 섹션의 나열식 목록 (→ Task별 참조 스킬로 이동)
- "모든 Task 완료 후 반복" 서술 (→ 검증 루프로 명시화)
- `tdd-workflow`, `e2e-testing` 스킬명 (실제 에이전트인 `tdd-guide`, `e2e-runner`로 대체)
