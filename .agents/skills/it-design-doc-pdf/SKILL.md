---
name: it-design-doc-pdf
description: Use when asked to convert, export, or print a 분석/설계서 Markdown (docs/design-docs/*.md produced by it-design-doc, possibly hand-edited) into a designed A4 PDF for this IT Portal project, or when the user asks for the 분석/설계서 "PDF로", "인쇄용", "보고용 파일".
---

# IT Portal 분석/설계서 PDF

## 핵심 계약

`it-design-doc`이 만든 분석/설계서 Markdown을 사용자가 수정한 그대로 읽어 브랜드 디자인(KDB CI·KDBGothic·NotoSansKR 내장, 공문서 표·번호 체계)이 적용된 A4 PDF로 만든다. Markdown 내용은 고치지 않는다. 양식이 깨져 있으면 PDF를 만들지 않고 어디가 깨졌는지 보고한다.

- 입력: `docs/design-docs/*.md` 한 파일. 사용자가 지정하지 않으면 그 디렉터리에서 가장 최근 수정된 파일. 사용자가 다른 위치(`tmp/`, 다운로드 폴더 등)의 파일을 지정하면 그대로 허용하며 출력 파일명은 그 파일명을 따른다.
- 출력: `output/pdf/{입력 파일명}.pdf`(`.gitignore` 대상, 커밋하지 않음). 사용자가 다른 경로를 주면 그대로 따른다.
- 원본 Markdown은 읽기 전용이다. 양식 위반을 발견하면 위반 줄과 선택지를 보이고 멈춘다. 사용자가 고쳐 달라고 하면 그때 `it-design-doc`의 섹션 규칙으로 최소 수정한다. 질문할 수 없는 비대화형 실행에서도 `--no-strict`로 강행하지 않고 실패를 그대로 보고한다.

## 실행

의존성은 `NODE_PATH` → 스킬 `node_modules` → `it-readme-pdf/node_modules`(marked) → `it_frontend/node_modules`(playwright·pdfjs-dist) 순으로 찾는다. 별도 설치 없이 기존 설치본을 재사용한다.

```powershell
node .agents/skills/it-design-doc-pdf/scripts/build-design-doc-pdf.mjs --check-deps

node .agents/skills/it-design-doc-pdf/scripts/build-design-doc-pdf.mjs `
  --input docs/design-docs/2026-09-15-analysis-design-since-260914.md `
  --screenshots tmp/design-doc/shots --pages 1,15-16
```

| 옵션 | 의미 |
| --- | --- |
| `--input` | 변환할 Markdown (필수) |
| `--output` | PDF 경로. 기본 `output/pdf/{파일명}.pdf` |
| `--subtitle` | 제목 아래 부제. 기본은 본문 `(수집 구간) …`에서 유도 |
| `--html` | 렌더 직전 HTML을 저장해 스타일을 점검할 때 |
| `--screenshots DIR` | pdf.js로 PDF 쪽을 PNG로 저장(`pdftoppm` 대체). `--pages 1-3,7`로 범위 지정, 생략하면 전체 쪽 |
| `--screenshots-only` | 기존 PDF를 다시 만들지 않고 쪽 이미지만 만든다(`--screenshots` 필수) |
| `--no-strict` | 양식 검증 실패를 경고로 낮춰 강행. 사용자가 명시적으로 요구할 때만 |

스크립트는 생성 뒤 pdfjs-dist로 PDF를 다시 열어 쪽수·제목 텍스트·테스트 시나리오 표의 쪽 범위를 로그에 남긴다(예: `검증: 20쪽, 제목 "분석/설계서" 확인, 테스트 시나리오 표 15~19쪽`).

## 양식 검증 (strict 기본)

| 검사 | 실패 시 |
| --- | --- |
| 템플릿 자리표시자 `{…}`·`{YY…}`·한글 포함 `{…}` 잔존 | 해당 줄을 찾아 사용자에게 보고 |
| `테스트 시나리오 (총 N건)`의 N ≠ `TC-` 행 수 | 사용자가 행을 넣거나 뺀 뒤 제목을 안 고친 것. 어느 쪽을 맞출지 확인 |
| `[요청자 정보]`·`[작성자 정보]` 표 부재 | 기본정보 상자를 만들 수 없음. 표 복원 요청 |

API 경로 변수(`/api/projects/{id}`)는 자리표시자로 보지 않는다.

## 디자인 규칙

Markdown 구조를 다음처럼 대응한다. 사용자가 헤딩 레벨을 바꾸면 디자인이 달라지므로 `it-design-doc` 템플릿의 레벨을 유지하도록 안내한다.

| Markdown | PDF |
| --- | --- |
| `# 제목` | 제목 띠(기관명·제목·부제, 우측 작성일자·작성자) |
| `### [요청자 정보]`, `### [작성자 정보]` 표 | 본문에서 분리해 나란히 놓은 기본정보 상자. `※` 줄은 상자 아래 주석 |
| `## 주요내용` | 표시하지 않음(양식 라벨) |
| `## 붙임`, 그 외 `##` | 남색 배경 띠 |
| `### [분석/설계 내용]` 등 | 좌측 굵은 선 + 연한 배경 절 제목 |
| `#### 1. 배경 및 개요` | 밑줄 소제목 |
| `##### 가. 화면` | 굵은 소소제목 |
| 목록 1·2·3단계 | ○ / - / · 공문서 기호 |
| 목록 항목·표 첫 열의 `**굵은 첫 토큰**` (`요건 1.`, `(배경)`, `현행`, `TC-01`) | 남색 키워드 |
| ```` ```flow ```` 블록(개요 도식) | 남색 테두리 도식 상자. `├─ 영역 : 키워드` 줄은 영역·키워드 2열 격자로 정렬(공백 맞춤 불필요), `[…]` 줄은 굵은 상자 라벨, 쪽 분리 금지 |
| 표 | 헤더 음영, 쪽 넘김 시 헤더 반복, 행 분리 금지 |

머리말은 좌측 KDB CI·우측 문서명, 꼬리말은 좌측 작성일자·가운데 쪽번호·우측 KDB 심볼. 글꼴은 `it_frontend/app/assets/fonts/`의 KDBGothic(제목)·NotoSansKR(본문)을 data URI로 내장해 시스템 글꼴에 의존하지 않는다.

## 워크플로우

1. 입력 파일을 정한다. 사용자 수정본을 덮어쓰거나 되돌리지 않는다. 입력이 `docs/design-docs/` 안이면 `git status`로, 밖이면 원본 `docs/design-docs/` 파일과 `diff`로 사용자 변경분을 파악해 둔다.
2. `--check-deps`로 실행 가능성을 확인한다. 실패하면 탐색 경로를 보고 `it_frontend`에 `npm ci`가 되어 있는지, `it-readme-pdf`에 marked가 설치돼 있는지 본다.
3. 변환을 실행한다. 양식 검증 실패는 Markdown을 보여 주고 사용자 결정을 받는다.
4. 로그의 시나리오 표 쪽 범위를 보고 `--screenshots-only --screenshots tmp/design-doc/shots --pages 1,{표 첫 쪽},{표 둘째 쪽}`으로 PNG를 만들어 Read 도구로 확인한다. 점검 항목: 제목 띠와 기본정보 상자가 1쪽에 있음, 표 헤더가 다음 쪽에 반복됨, 한글·한자·코드 경로가 빈칸 없이 출력됨, 자리표시자 없음.
5. 산출물 경로, 쪽수, 검증 결과, 강행(`--no-strict`)한 경고를 보고한다.

## 검증

```powershell
node --test .agents/skills/it-design-doc-pdf/tests/build-design-doc-pdf.test.mjs
```

## 흔한 실수

- 사용자가 고친 Markdown을 "양식에 맞게" 되돌린다 → 내용은 사용자 것이다. 검증 실패만 보고하고 수정은 요청받은 뒤 한다.
- `--no-strict`를 기본으로 쓴다 → 자리표시자가 그대로 인쇄된 PDF가 나간다.
- `output/pdf/*.pdf`나 `tmp/` 이미지를 커밋한다 → 둘 다 재생성 가능한 미추적 산출물이다.
- 한자·특수문자가 빈칸으로 보이는데 넘어간다 → 내장 글꼴이 로드되지 않은 것. `--html`로 저장한 파일의 `@font-face`가 비어 있지 않은지 확인한다.
