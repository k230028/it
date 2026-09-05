---
name: it-test-maintenance
description: Use when analyzing this IT Portal project's coverage gaps, adding or improving JUnit, Vitest, or Playwright tests, running quality gates, or generating the consolidated test report.
---

# IT Portal 테스트 유지보수

## 핵심 원칙

현재 코드의 계약을 검증하는 테스트를 작성하고 실제 실행 결과로 완료를 판단한다. 루트와 대상 저장소의 `CLAUDE.md`, 테스트 가이드, 빌드 설정을 명령·임계값·Mock 규칙의 SoT로 사용한다.

## 모드

| 요청 | 수행 범위 |
| --- | --- |
| 갭 분석 | 실제 커버리지 결과를 우선 사용해 미달 파일, 무테스트 서비스·composable, 미검증 분기를 정렬한다. |
| 단위·통합 테스트 보강 | 기존 계약의 성공·실패·경계 사례를 테스트하고 필요한 테스트 파일만 수정한다. |
| E2E 보강 | `it_frontend/tests/e2e`의 실제 구현과 핵심 사용자 흐름을 대조한다. |
| 정적 점검 | 현재 `package.json`, Gradle, 각 저장소 `CLAUDE.md`가 지정한 품질 명령을 실행한다. |
| 결과 보고서 | 기존 생성기를 실행해 `docs/test/test-report-YYYY-MM-DD.html`을 만든다. |

사용자가 특정 모드만 요청하면 나머지 모드는 실행하지 않는다. `TEST.md` 전체 워크플로우를 요청한 경우 갭 분석, 테스트 보강, E2E, 보고서, 품질 게이트 순으로 수행한다.

## 워크플로우

1. 대상 저장소 규칙과 현재 테스트·커버리지 설정을 읽는다.
2. 기존 리포트가 있으면 수치를 파싱하고, 없으면 테스트와 소스를 교차 분석하되 추정임을 표시한다.
3. 위험도와 미커버 정도로 대상을 정한다. 임계값은 문서가 아니라 아래 빌드 설정에서 읽는다.

| 대상 | 임계값 SoT |
| --- | --- |
| 백엔드 커버리지 | `it_backend/build.gradle`의 `jacocoTestCoverageVerification`. `check`에 연결되어 있다 |
| 프론트 커버리지 | `it_frontend/vitest.config.ts`의 `coverage.thresholds`와 `coverage.include` |
| 백엔드 품질 게이트 | `./gradlew check` (Spotless·JaCoCo 포함) |
| 프론트 품질 게이트 | `npm run format:check`, `npm run check`(typecheck·lint·check:copy), `npm run lint:css`, `npm test` |

`coverage.include` 밖의 파일을 커버리지 미달로 보고하지 않는다. 프론트 커버리지 측정은 `npm run test:coverage`로 실행한다.

4. 테스트를 작성하거나 보강하고 해당 테스트부터 실행한다.
5. 영향 범위의 전체 테스트와 품질 게이트를 새로 실행한다.
6. 보고서 요청 시 `it_frontend`의 `generate-report` 스크립트를 사용한다.

테스트 보강 범위에서는 비즈니스 로직을 수정하지 않는다. 제품 결함 때문에 테스트가 실패하면 근거와 재현 절차를 보고하고, 사용자가 수정까지 요청한 경우에만 별도 버그 수정 흐름으로 전환한다.

실제 브라우저 검증에는 실행 중인 서버를 사용한다. 격리된 E2E 계약 테스트의 API Mock은 기존 테스트 정책이 허용하는 범위에서만 사용한다.

## 결과 형식

- 측정 기준과 입력 리포트
- 추가·변경한 테스트
- 실행 명령과 성공·실패 수
- 남은 미달·차단 원인
- 생성한 보고서 경로

## 흔한 실수

- 오래된 `TEST.md` 명령이나 인라인 스캐폴드를 현재 설정보다 우선한다.
- 임계값을 스킬·주석에 적힌 숫자에서 읽고 빌드 설정을 확인하지 않는다.
- `coverage.include` 범위 밖 파일을 커버리지 갭으로 보고한다.
- 커버리지 파일이 없는데 실측값처럼 단정한다.
- Mock 호출 횟수만 검증하고 사용자 관찰 가능한 동작을 검증하지 않는다.
- 실패한 제품 코드를 테스트 기대값 완화로 숨긴다.
