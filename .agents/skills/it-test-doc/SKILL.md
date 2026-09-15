---
name: it-test-doc
description: Use when asked to write a 테스트 결과서, 테스트결과서, 시험 결과 보고서, or a public-institution style test result document for this IT Portal project from a 분석/설계서's test scenarios (e.g. "이 분석/설계서 테스트 결과서 작성해줘", "YYMMDD 이후 수정분 테스트 결과서"), including running the referenced Vitest, JUnit(Jacoco), or E2E tests and recording PASS/FAIL with evidence.
---

# IT Portal 테스트 결과서 작성

## 핵심 계약

분석/설계서(`it-design-doc` 산출물)의 테스트 시나리오 표를 대상으로 자동화 테스트를 **실제로 실행**하고, 시나리오별 실제결과(PASS/FAIL)와 증적을 `template.md` 양식의 공문서 스타일 테스트 결과서로 만든다. 실행하지 않은 결과를 PASS로 적지 않는다.

- 문체·형식·강조는 `it-design-doc`과 같다: 명사형 종결, 표·목록 전용, 첫 토큰과 구분 열만 굵게. 단, 결과서는 `## 붙임`에 실행 로그 링크를 두고 E2E 스크린샷을 본문에 넣는다(둘 다 목록 항목 형식).
- 실제결과 값은 `PASS` · `FAIL` · `미실시` · `미확인` 넷 중 하나. 사용자 시나리오와 `--skip-*`로 건너뛴 시나리오는 `미실시`, 참조 테스트를 찾지 못했거나 `(신설)` E2E spec이 아직 없는 시나리오는 `미확인`.
- E2E는 기본 실행이다. spec이 `page.route`로 API를 mock하고 Playwright `webServer`가 nuxt dev(3002)를 기동·재사용하므로 백엔드·실데이터가 없어도 돈다.
- 예상결과 열은 시나리오가 통과해야 하는 것이므로 `PASS`로 적고, 설계서의 예상결과 문구는 점검 포인트 열에 `·`로 이어 붙인다.
- 증적은 결과서와 함께 남는 파일이어야 한다. 로그·JUnit XML은 `docs/test-docs/evidence/{작성일}/`에 두고 증적 열에서 경로를 가리킨다. `tmp/`는 증적이 아니다.
- 산출물: `docs/test-docs/{작성일 YYYY-MM-DD}-test-result-{설계서 식별자}.md` (예: 설계서가 `…-since-260914.md`면 `2026-09-15-test-result-since-260914.md`).
- 저장소 상태를 바꾸지 않는다. 테스트가 실패해도 소스·테스트를 고치지 않고 FAIL로 기록한다(수정은 사용자가 따로 요청할 때 `it-test-maintenance`).

## 입력 해석

| 입력 | 해석 |
| --- | --- |
| 분석/설계서 경로 | 그 문서의 시나리오 표가 대상 |
| `YYMMDD 이후 수정분` 등 기간만 | `docs/design-docs/`에서 `since-{YYMMDD}` 설계서를 찾는다. 없으면 `it-design-doc`으로 먼저 만들지 사용자에게 묻는다 |
| 요청자·작성자 정보 | 사용자 지시 → 설계서의 요청자·작성자 표 → `(미기재)` |
| 사용자 시나리오 결과 | 사용자가 결과·증적(스크린샷 경로 등)을 주면 그 값으로 기입, 없으면 `미실시` |
| "E2E 빼고", "빠르게" | `--skip-e2e`. 사용자가 명시할 때만 건너뛴다 |

## 워크플로우

1. 루트 `CLAUDE.md`와 대상 분석/설계서를 읽는다. 요청자·작성자 표와 수집 구간, 시나리오 총 건수를 확인한다.
2. 실행기를 루트에서 실행한다. 증적 디렉터리는 작성일 기준으로 준다.

```powershell
node .agents/skills/it-test-doc/scripts/run-scenarios.mjs `
  --design docs/design-docs/2026-09-15-analysis-design-since-260914.md `
  --evidence docs/test-docs/evidence/2026-09-15 `
  --out tmp/test-doc/results.json
```

   | 옵션 | 의미 |
   | --- | --- |
   | `--design` | 시나리오 표를 읽을 분석/설계서 (필수) |
   | `--evidence DIR` | 로그·JUnit XML 저장 위치. 기본 `docs/test-docs/evidence/{오늘}` |
   | `--out` | 시나리오별 결과 JSON. 같은 폴더에 7열 표 초안 `table-draft.md`도 만든다 |
   | `--skip-e2e` | Playwright를 건너뛰고 `미실시`로 기록. 기본은 실행(`--include-e2e`는 옛 호출 호환용 no-op) |
   | `--skip-frontend`, `--skip-backend` | 해당 저장소 테스트를 건너뛰고 `미실시`로 기록 |

   실행기는 점검 포인트의 백틱 참조에서 `*.test.ts`(Vitest)·`*Test.java`(JUnit, `--tests '*클래스'`)·`*.spec.ts`(E2E)를 뽑아 한 번씩 실행한다. Vitest 실패 파일은 한 번 재실행하고 1차 결과를 증적에 남긴다. E2E는 Playwright JSON 리포터(`playwright-results.json`)로 spec 파일별 통과·실패를 집계하고, 설정의 `retries: 1`로 재시도 통과한 건은 `(재시도 통과 n)`으로 남긴다. 이번 실행 전에 만들어진 JUnit XML은 증적으로 쓰지 않는다.
3. `results.json`의 `counts`·`exit`·`scenarios[].status/evidence/failures`를 읽는다. 종료코드가 0이 아니거나, 0인데 실행 클래스·파일 수가 0이면 로그를 열어 원인(빌드 실패, 도구 미설치, Gradle UP-TO-DATE)을 확인한다. 실행기는 `cleanTest`를 앞에 붙여 UP-TO-DATE를 막지만, 그래도 `미확인`이 남으면 사유를 적는다.
4. `template.md`를 채운다. 세부내용 표는 `table-draft.md`를 옮기되 증적 열은 아래 규칙으로 다듬는다.
5. 검증 체크리스트를 통과시킨 뒤 산출물 경로, 결과 요약, FAIL·미확인 목록(`(신설)` E2E spec 미작성분은 `it-test-maintenance`로 작성한 뒤 재실행해야 함을 안내), 사용자 확인이 필요한 `미실시` 건수를 보고한다.

## 섹션별 작성 규칙

| 섹션 | 규칙 |
| --- | --- |
| (대상 문서) | 설계서 경로 · 요건 수 · 시나리오 수 |
| (실행 일시) | `results.json`의 `startedAt`~`finishedAt`을 현지 시각으로. 실행 시점 `it_frontend`·`it_backend` HEAD 해시(`git -C … rev-parse --short HEAD`) |
| (실행 명령) | `results.json.commands`의 명령을 그대로. 파일·클래스가 많으면 `… 외 N개`로 줄인다 |
| (증적 위치) | `results.json.evidenceDir`. 세부내용 표의 증적 경로는 이 디렉터리 기준 상대 경로(`vitest.log`, `TEST-….xml`)만 적는다 |
| (결과 요약) | `counts` 그대로. 미실시는 사용자·E2E로 나눠 괄호에 적는다 |
| (결과 도식) | ```flow 블록. 구분별 건수→결과. 마지막 `[판정]`은 자동화 PASS 비율과 사용자 확인 대기 건수 |
| 테스트 세부내용 | TEST ID·시나리오명·구분은 설계서와 같게. 점검 포인트는 `table-draft.md`대로 설계서 점검 포인트 뒤에 `· 설계서 예상결과`를 이어 붙인 것. 예상결과 `PASS`. 실제결과는 실행기 상태값. 증적: Vitest는 `` 파일 → n/n passed · 로그 `vitest.log` ``, JUnit은 `` 클래스 → n/n passed · `TEST-….xml` ``(초안이 이미 이 형식), 재실행이면 `(재실행; 1차 …)`를 남긴다. E2E는 `` spec → '제목' passed · `playwright-results.json` ``(제목 없는 행은 `n/n passed (재시도 통과 n)`). 미실시는 사유(`사용자 확인 필요`, `--skip-e2e`), 미확인은 못 찾은 참조·`E2E spec 미작성(신설 예정: …)`·`test 미작성 — '제목'` |
| FAIL 상세 | FAIL 시나리오마다 실패 테스트명·오류 메시지 첫 줄·조치 구분. E2E 단언이 설계서 요건으로 바뀐 화면 구조(예: iframe→canvas 뷰어, 목록 기본 범위 변경)와 어긋나면 "테스트 현행화"로, 재시도에도 같은 화면 오류면 "결함 등록"으로 적는다. FAIL이 없으면 절을 만들지 않는다 |
| E2E 증적 스크린샷 | `results.json.scenarios[].screenshots`를 시나리오별 목록으로. 항목 글은 `**TC-nn-k** 제목 · PASS/FAIL · 파일명`, 그 아래 들여쓴 `![…](evidence/{작성일}/e2e/screenshots/…)` 이미지. 스크린샷은 실행기가 항상 찍으므로 PASS 화면도 넣는다 |
| 붙임 | `- [파일명](evidence/{작성일}/…) — 설명` 목록만. 실행기가 만든 `vitest.log`·`gradle-test.log`·`e2e/playwright.log`를 있는 것만 나열한다. 로그 원문을 본문에 옮겨 적지 않는다 |

## 검증

```powershell
node --test .agents/skills/it-test-doc/tests/run-scenarios.test.mjs
```

## 검증 체크리스트

- 세부내용 표 행 수 = 제목의 "총 N건" = 설계서 시나리오 수. TEST ID 순서가 설계서와 같다.
- 실제결과가 `PASS`인 행은 증적 열에 `n/n passed`와 존재하는 파일 경로가 있다. `Test-Path -LiteralPath`로 경로를 확인한다.
- `results.json.counts`와 (결과 요약)·(결과 도식)의 숫자가 같다.
- 실제결과 값이 네 가지 상태값 외에 없다: `awk -F'|' '/^\| \*\*TC-/{gsub(/[ *]/,"",$7); print $7}' 파일 | sort | uniq -c`로 6번째 열만 센다.
- FAIL이 있으면 "FAIL 상세" 절이 있고, 없으면 절이 없다.
- 줄글이 없다: `awk '/^```/{c=!c;next} !c && !/^(s*$|s*[-|#※!])/' 파일` 출력 0줄(`!`는 들여쓴 이미지 줄). `{…}` 자리표시자가 없다.
- E2E 시나리오가 있으면 "E2E 증적 스크린샷" 절의 이미지 파일이 모두 존재한다. `## 붙임`의 링크 파일이 모두 존재한다.
- (증적 위치)가 `docs/test-docs/evidence/` 아래이고 그 안에 증적 열이 가리키는 파일이 모두 존재하며, `tmp/` 경로를 가리키는 증적이 없다.

## 흔한 실수

- 실행기를 돌리지 않고 설계서의 예상결과를 실제결과로 옮긴다 → 실제결과는 `results.json`에서만 온다.
- 옛 `build/test-results` XML을 증적으로 쓴다 → 실행기가 이번 실행분만 복사한다. 로그에 `BUILD SUCCESSFUL`이 없으면 미확인이다.
- 콜드 스타트 timeout을 결함으로 적는다 → 재실행(Vitest)·재시도(E2E) 통과면 PASS로 두고 `(재실행; 1차 timeout)`·`(재시도 통과 n)`을 증적에 남긴다. 재실행도 실패면 FAIL.
- E2E를 "서버가 없어서" 미실시로 둔다 → spec이 API를 mock하고 webServer가 nuxt dev를 띄우므로 실행한다. 3002 포트 충돌·브라우저 미설치(`npx playwright install chromium`)만 환경 원인이다.
- 사용자 시나리오를 PASS로 채운다 → 사용자가 결과를 주기 전에는 `미실시`.
- FAIL을 고치려고 소스를 수정한다 → 결과서는 기록이다. 수정은 별도 요청.

## 후속

PDF가 필요하면 `it-test-doc-pdf`를 사용한다.
