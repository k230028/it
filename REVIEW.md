## 기본 지침
 - 이 작업은 모든 계획과 실행(cli 명령어 포함)에 대해 확인받지 않고 작업을 진행한다.
 - 모든 문서 작업은 기존의 파일 인코딩(UTF-8)을 유지하며, [현행화 대상 파일]의 기존 구조를 파괴하지 않고 섹션을 추가하거나 내용을 보강하는 방식으로 진행한다.
 - 속도보다 정확도가 중요한 작업이다.
 - [Task 1]부터 [Task 4]까지 순서대로 진행하고, 각 Task 내에서 지정된 에이전트를 병렬로 활용한다.
 - 모든 Task를 완료한 후에는 [검증] 단계를 실행하여 [현행화 대상 파일]이 최신 상태인지 확인하고, 누락된 부분이 없을 때까지 반복한다.
 - Reference: 모든 작업의 최우선 순위는 루트의 CLAUDE.md에 정의된 규범을 따름

### 서브에이전트 표기 규약
 - 아래 표의 역할 이름(`java-reviewer` 등)은 **전용 에이전트 정의가 아니라 범용 서브에이전트에 부여하는 역할 지시**다. 프로젝트에는 `.claude/agents/` 정의를 두지 않는다.
 - 병렬 역할은 `/superpowers:dispatching-parallel-agents` 절차로 한 번에 띄우고, 각 역할의 담당 범위·출력 형식을 프롬프트에 명시한다.
 - 각 역할은 `.claude/skills/`의 프레임워크 참조 스킬(CLAUDE.md §5.4)로 관례 기준을 잡되, 프로젝트 규칙과 충돌하면 해당 저장소의 `CLAUDE.md`·`docs/guides/`를 우선한다.

### 현행화 대상 파일
 - C:\it\README.md
 - C:\it\CLAUDE.md
 - C:\it\TASK.md
 - C:\it\it_frontend\README.md
 - C:\it\it_frontend\CLAUDE.md
 - C:\it\it_backend\README.md
 - C:\it\it_backend\CLAUDE.md

---

## [Task 1: Source Code Annotation]

### 서브에이전트 역할 (병렬 실행)
다음 3개 역할을 병렬 서브에이전트로 실행하여 각자 탐지 목록을 생성한다.

| 역할 | 담당 범위 | 분석 관점 |
|---------|---------|---------|
| `java-reviewer` | `it_backend` 전체 `.java` | 레이어드 아키텍처 준수·JPA 패턴·트랜잭션 경계·예외처리 주석 누락 및 오류 탐지 |
| `typescript-reviewer` | `it_frontend` 전체 `.ts`·`.vue` | 타입 안전성·`useApiFetch`/`$apiFetch` 패턴·Composable 구조 주석 누락 및 오류 탐지 |
| `silent-failure-hunter` | 전체 소스 | 빈 catch·누락된 에러 전파·오류 삼킴 탐지 → `TODO:`/`FIXME:` 추가 대상 목록 생성 |

### 통합 (순차 실행)
 - `comment-analyzer` — 위 3개 에이전트의 탐지 결과를 통합하여 실제 주석 추가·수정 실행

### 참조 기준
 - `/springboot-patterns` + `/java-coding-standards` + `it_backend/CLAUDE.md`·`docs/guides/` — 백엔드 컨벤션 기준 로드
 - `/nuxt4-patterns` + `/vue-patterns` + `it_frontend/CLAUDE.md`·`docs/guides/` — 프론트엔드 컨벤션 기준 로드
 - 스킬과 저장소 문서가 어긋나면 저장소 문서가 SoT (CLAUDE.md §5.4 예외 목록 확인)

### 규칙
 - CLAUDE.md §4.1 한글 주석 원칙을 따름
 - 파일 헤더, 클래스/인터페이스, public 메서드, 복잡한 로직의 변수에 주석 누락 여부를 전수 조사한다.
 - 기존 주석 중 실제 동작과 불일치하거나 가독성이 낮은 주석은 최신 로직에 맞게 한글로 수정한다.
 - **비즈니스 로직(코드 자체)은 절대 수정하지 않는다.**

---

## [Task 2: README.md Update]

### 서브에이전트 역할 (병렬 실행)
 - `doc-updater` (BE) — `it_backend` 전체 분석 → `it_backend/README.md` 업데이트
 - `doc-updater` (FE) — `it_frontend` 전체 분석 → `it_frontend/README.md` 업데이트

### 통합 (순차 실행)
 - 위 두 결과를 바탕으로 루트 `README.md` 업데이트

### 규칙
 - 신규 개발자가 프로젝트에 투입되었을 때 흐름을 파악할 수 있도록 컨텍스트 위주로 작성한다.
 - 아키텍처의 핵심 설계 결정(Design Decisions), 주요 모듈 간 관계, 기술 스택의 특징을 상세히 기술한다.
 - 구현이 코드에서 확인된 내용만 기술한다. (미구현·계획 내용 금지)
 - Task 3(CLAUDE.md) 반영 필요 사항은 메모해두고 Task 3에서 처리한다.
 - Task 4(TASK.md) 반영 필요 사항은 메모해두고 Task 4에서 처리한다.

---

## [Task 3: CLAUDE.md Update]

### 서브에이전트 역할
 - `doc-updater` — 코드베이스 분석 → CLAUDE.md 컨벤션·규칙 업데이트
 - `security-reviewer` — 인증/인가 코드(`common/system/`·`config/Security*`) 검토 → CLAUDE.md 보안 규칙 보강

### 참조 스킬
 - `/springboot-security` — Spring Security 인증·인가·검증·헤더 점검 기준 로드
 - `/security-review` (Claude Code 내장) — OWASP Top 10·JWT·RBAC 패턴 기준 적용
 - 본 프로젝트 인증은 httpOnly 쿠키 기반이므로, 토큰 저장·CSRF 관련 스킬 권고는 루트 CLAUDE.md §4.2와 `it_backend/CLAUDE.md` 인증 절 기준으로 해석한다.

### 규칙
 - 실제 코드에서 확인된 규칙만 기록한다. (휘발성·카운트 정보 금지)
 - Task 2 작성 중 메모해둔 항목을 반영한다.

---

## [Task 4: TASK.md Maintenance]

### 서브에이전트 역할 (병렬 실행)
 - `refactor-cleaner` — 미사용 코드·dead import·중복 로직 탐지
 - `database-reviewer` — JPA 엔티티 설계·QueryDSL N+1·인덱스 누락 이슈 탐지 (`/jpa-patterns` 기준 로드, 단 DDL·인덱스 조치는 실행하지 않고 Flyway 과제로만 등록)

### 통합 (순차 실행)
 - Task 1 `silent-failure-hunter` 결과 + 위 2개 역할 결과를 TASK.md 신규 과제로 통합 등록
 - 기존 TASK.md 항목 전수 검사 → 코드상 구현이 완료된 항목은 `[Done]` 상태로 업데이트하고 조치 일자 기록

---

## [검증: Verification Loop]

### 서브에이전트 역할
 - `code-reviewer` — 전체 변경사항의 일관성·품질 최종 확인 (diff 기준 점검은 `/code-review` 병행)

### 절차
 1. [현행화 대상 파일] 전체가 최신 코드를 반영하는지 점검한다.
 2. 누락 또는 불일치가 발견되면 해당 Task만 재실행한다.
 3. 모든 항목이 충족될 때까지 반복한다.
