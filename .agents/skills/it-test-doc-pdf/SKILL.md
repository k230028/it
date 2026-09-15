---
name: it-test-doc-pdf
description: Use when asked to convert, export, or print a 테스트 결과서 Markdown (docs/test-docs/*.md produced by it-test-doc, possibly hand-edited with user test results) into a designed A4 PDF for this IT Portal project, or when the user asks for the 테스트 결과서 "PDF로", "인쇄용", "보고용 파일".
---

# IT Portal 테스트 결과서 PDF

## 핵심 계약

`it-test-doc`이 만든 테스트 결과서 Markdown을 사용자가 수정한 그대로(사용자 시나리오 결과 기입 포함) 읽어 `it-design-doc-pdf`와 같은 브랜드 디자인의 A4 PDF로 만든다. 변환기는 `it-design-doc-pdf`의 스크립트를 공용으로 사용하며 제목이 "테스트 결과서"이면 결과서 규칙으로 동작한다. Markdown 내용은 고치지 않는다.

- 입력: `docs/test-docs/*.md` 한 파일. 지정이 없으면 가장 최근 수정 파일. 다른 위치의 파일도 허용하며 출력 파일명은 그 파일명을 따른다.
- 출력: `output/pdf/{입력 파일명}.pdf` (미추적, 커밋하지 않음).
- 양식 위반이면 PDF를 만들지 않고 위반 줄과 선택지를 보이고 멈춘다. 비대화형 실행에서도 `--no-strict`로 강행하지 않는다.

## 실행

```powershell
node .agents/skills/it-design-doc-pdf/scripts/build-design-doc-pdf.mjs --check-deps

node .agents/skills/it-design-doc-pdf/scripts/build-design-doc-pdf.mjs `
  --input docs/test-docs/2026-09-15-test-result-since-260914.md `
  --screenshots tmp/test-doc/shots --pages 1-2
```

옵션(`--output`, `--subtitle`, `--html`, `--screenshots`, `--pages`, `--screenshots-only`, `--no-strict`)은 `it-design-doc-pdf`와 같다. 부제는 본문 `(실행 일시)` 줄에서 유도한다.

## 결과서 전용 규칙

| 검사·표현 | 동작 |
| --- | --- |
| `테스트 세부내용 (총 N건)`의 N ≠ `TC-` 행 수 | 검증 실패. 사용자가 행을 넣거나 뺀 뒤 제목을 안 고친 것 |
| 세부내용 표 행의 열이 7개가 아니거나 실제결과가 `PASS`·`FAIL`·`미실시`·`미확인` 밖 | 검증 실패. 사용자가 사용자 시나리오 결과를 기입하다 오타·열 누락을 낸 경우가 대부분 |
| 표 셀의 `PASS` / `FAIL` / `미실시` / `미확인` | 초록 / 빨강 / 회색 / 주황 배지 |
| 본문의 상대 경로 이미지(`![…](evidence/…/…png)`) | 문서 위치 기준으로 읽어 data URI로 내장. 캡션(목록 항목 글)과 이미지는 같은 쪽에 둔다. 못 찾은 이미지는 경고 후 빈 칸 |
| `## 붙임`의 `- [파일명](경로)` 링크 중 `.log`·`.txt`·`.md`·`.xml`·`.json` | 본문 뒤에 "붙임 N. 파일명" 제목으로 새 쪽부터 원문을 6.6pt 고정폭으로 첨부(ANSI 색 코드 제거). 못 찾은 파일은 경고 |
| `[요청자 정보]`·`[작성자 정보]`, `※` 주석, `##`·`###`·`####`, 목록 기호, ```flow 도식, 굵은 첫 토큰 | `it-design-doc-pdf` 디자인 규칙과 동일 |

## 워크플로우

1. 입력 파일을 정하고 사용자 변경분을 `git diff`로 파악한다(사용자가 `미실시`를 `PASS`/`FAIL`로 바꾸고 증적을 적었는지). 되돌리지 않는다.
2. `--check-deps` 뒤 변환을 실행한다. 검증 실패는 Markdown 줄을 보여 주고 사용자 결정을 받는다.
3. 로그의 "테스트 시나리오 표 n~m쪽"을 보고 `--screenshots-only --pages 1,{n},{m+1}`으로 PNG를 만들어 Read 도구로 확인한다. 점검: 1쪽 제목 띠·기본정보 상자·결과 도식, 표의 배지 색, 표 헤더 반복, 증적 경로가 잘리지 않음, 스크린샷 절에서 캡션과 이미지가 같은 쪽, 붙임 로그가 새 쪽에서 시작. 붙임 로그는 수십 쪽이 될 수 있으므로 쪽수를 보고 사용자에게 알린다.
4. 산출물 경로·쪽수·검증 결과와 아직 `미실시`로 남은 사용자 시나리오 건수를 보고한다.

## 검증

```powershell
node --test .agents/skills/it-design-doc-pdf/tests/build-design-doc-pdf.test.mjs
```

## 흔한 실수

- 사용자가 기입한 `PASS`를 증적이 없다고 `미실시`로 되돌린다 → 결과는 사용자 것이다. 증적 누락은 보고만 한다.
- `--no-strict`로 실제결과 오타를 그대로 인쇄한다 → 오타는 배지가 안 그려져 바로 드러난다. 고치도록 안내한다.
- 붙임 로그가 너무 길다고 임의로 잘라 첨부한다 → 원문 그대로 첨부한다. 줄이려면 사용자가 Markdown의 `## 붙임`에서 링크를 빼야 한다.
