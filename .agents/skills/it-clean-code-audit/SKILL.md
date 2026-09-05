---
name: it-clean-code-audit
description: Use when performing an evidence-backed Clean Code, maintainability, architecture-boundary, error-handling, or test-quality audit of this IT Portal project's backend and frontend.
---

# IT Portal Clean Code 진단

## 핵심 원칙

진단과 수정을 분리한다. 발견 사항은 코드 위치와 재현 가능한 근거가 있을 때만 보고하며, CRITICAL과 버그성 HIGH는 관련 타입·계약·호출부를 직접 교차검증한다.

## 범위

- 백엔드 `src/main`과 `src/test`: 이름, 함수, 오류 처리, SRP, 중복, 계층 경계, 테스트 품질
- 프론트엔드 `app`, `server`, `tests`: 타입 우회, 거대 컴포넌트·composable, 오류 삼킴, 중복, HTML 안전성, 테스트 품질
- 제외: 의존성·빌드 산출물과 적용된 `it_database/migrations/`

루트와 각 저장소의 `CLAUDE.md` 및 `docs/guides/`가 일반 Clean Code 조언보다 우선한다.

### 프로젝트 고유 계약

일반 Clean Code 관점과 별개로 루트 `CLAUDE.md`가 명시한 아래 계약 위반을 함께 탐지한다. 이 프로젝트에서 실제로 반복 발생한 결함군이므로 일반 스타일 지적보다 우선순위가 높다.

- 목록 API에 DB 필터, 명시적 안정 정렬, 유한한 페이지나 상한이 함께 적용되었는가.
- bulk 조회가 IN 배치 대신 반복 조회로 N+1을 만들지 않는가.
- 빈 결과, 누락 값, malformed 입력, 조회 실패를 같은 상태로 뭉개지 않는가. malformed 값을 기본값이나 미존재로 숨기지 않는가.
- 초기 조회 실패를 정상 빈 화면으로 대체하지 않고 재시도 가능한 오류 상태로 유지하는가. 재조회 실패 때 이전 성공 데이터를 새 성공처럼 표시하지 않는가.
- 사업·비용 조회가 관리번호와 순번을 함께 사용하는가. 후속 업무 목록·집계·bulk 조회가 `LST_YN='Y'` 최종본만 사용하는가.
- 백엔드 DTO·OpenAPI 변경에 대해 프론트 생성 타입과 소비 코드가 함께 갱신되었는가. 생성 타입을 수기로 편집하지 않았는가.

## 워크플로우

1. 직전 `docs/clean-code-review-*.md`와 활성 `TASK.md`를 읽어 기준선을 잡는다.
2. 이미 자동화로 관리 중인 항목을 확인한다. 아래 기준선·게이트가 붙잡고 있는 문제는 신규 발견으로 올리지 않고, 기준선이 악화됐거나 면제가 회수되지 않은 경우에만 보고한다.

| 자동화 | 위치 |
| --- | --- |
| 파일 길이 래칫 | `it_frontend/scripts/max-lines-baselines.mjs` |
| 사용자 노출 문구 래칫 | `it_frontend/scripts/user-facing-copy-baselines.mjs`, `npm run check:copy` |
| 포맷·정적 검사 | `it_backend` Spotless(`check` 연결), `npm run format:check`, `npm run lint`, `npm run lint:css` |
| 커버리지 게이트 | `it_backend` JaCoCo(`check` 연결), `it_frontend` vitest coverage 임계값 |

3. 소스 규모와 대형 파일을 파악하되 중소형 파일도 표본 조사해 국소 문제와 전역 경향을 구분한다.
4. 이름·함수·클래스·중복·오류 처리·타입 안전·테스트·아키텍처 관점으로 탐지한다.
5. 각 후보를 코드와 계약에서 재확인하고 오탐은 제외 사유와 함께 기록한다.
6. 보고서 요청 시 `docs/clean-code-review-YYYY-MM-DD.md`에 직전 대비 해결·잔존·신규를 구분한다.
7. 사용자가 전체 진단 실행이나 백로그 반영을 요청한 경우에만 검증된 개선사항을 `TASK.md`의 기존 형식과 중복 여부에 맞춰 등록한다.

## 발견 사항 계약

각 발견 사항은 다음 필드를 갖는다.

- 심각도: CRITICAL, HIGH, MEDIUM, LOW
- 제목과 사용자·운영 영향
- 파일과 정확한 라인
- 짧은 코드 근거
- 원칙 또는 프로젝트 규칙
- 최소 개선 방향
- 기존 `TASK.md` 항목과의 관계

점수는 발견 건수보다 확산 범위와 구조적 영향에 근거한다. 강점도 실제 좋은 선례를 확인한 경우에만 기록한다.

## 종료 조건

- CRITICAL 전건과 버그성 HIGH가 교차검증되었다.
- 보고서의 파일·라인 인용이 현재 코드와 일치한다.
- 점수 변동은 델타 근거로 설명된다.
- 요청된 경우 보고서와 `TASK.md` 사이에 누락이나 중복이 없다.

## 흔한 실수

- 대형 파일만 보고 코드베이스 전체 문제로 일반화한다.
- 스타일 선호를 프로젝트 규칙 위반처럼 보고한다.
- 진단 요청에서 비즈니스 로직을 함께 수정한다.
- 에이전트나 정적 검색 결과를 재검증 없이 확정한다.
