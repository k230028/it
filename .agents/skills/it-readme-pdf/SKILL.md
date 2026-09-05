---
name: it-readme-pdf
description: Use when generating a single PDF from this IT Portal project's root README and only the local Markdown documents linked directly from that README.
---

# IT Portal README PDF

## 핵심 계약

루트 `README.md` 본문과 README가 직접 연결한 로컬 `.md`·`.markdown` 문서만 하나의 PDF로 만든다. 링크된 문서에서 다른 문서를 재귀 탐색하지 않는다.

`pdf` 스킬을 사용할 수 있는 하네스에서는 PDF 생성·검증에 함께 적용한다. 없으면 아래 절차만으로 수행한다.

## 실행

스크립트는 `marked`와 `playwright`를 `NODE_PATH` → 스킬 전용 `node_modules` → `it_frontend/node_modules` 순서로 찾는다. 하네스가 의존성을 주입하면 그대로 쓰고, 아니면 스킬 디렉터리에서 한 번만 설치한다.

1. 루트 `CLAUDE.md`와 현재 Git 변경을 확인한다.
2. 의존성을 선점검한다. 실패하면 메시지의 탐색 경로를 보고 해결한 뒤 진행한다.

```powershell
# marked가 없을 때만 최초 1회
npm install --prefix .agents/skills/it-readme-pdf

node .agents/skills/it-readme-pdf/scripts/build-readme-pdf.mjs --check-deps
```

3. 루트에서 생성 스크립트를 실행한다. 시각 검토가 필요하면 `--screenshots`를 함께 준다.

```powershell
node .agents/skills/it-readme-pdf/scripts/build-readme-pdf.mjs `
  --entry README.md `
  --workspace . `
  --output output/pdf/it-project-portal-readme-direct-links.pdf `
  --screenshots tmp/pdfs/screenshots
```

`output/`과 `tmp/`는 `.gitignore` 대상이다. 생성한 PDF와 스크린샷을 커밋하지 않는다.

스크립트는 README를 첫 문서로 두고 직접 링크를 최초 등장 순서로 포함한다. Marked가 Markdown 링크 토큰으로 해석한 인라인·참조형 링크를 대상으로 하며 raw HTML `<a>`는 문서 목록에 넣지 않는다. query와 fragment를 제거하고 URL 디코딩·`realpath`를 거친 실제 경로 기준으로 중복을 제거한다.

| README 링크 | 처리 |
| --- | --- |
| 상대 `.md`·`.markdown` | 직접 문서로 한 번 포함 |
| 같은 문서의 다른 fragment | 최초 문서만 포함 |
| 외부 URL·앵커·이미지·비-Markdown | 문서 목록에서 제외 |
| 누락·절대경로·워크스페이스 밖 문서 | 생성 실패 |

연결 문서의 링크는 다시 수집하지 않는다. 로컬 이미지는 해당 원본 문서 디렉터리를 기준으로 URL 디코딩·`realpath` 검증 후 data URI로 포함하며, 누락·지원 불가 형식·워크스페이스 밖 이미지는 생성 실패로 처리한다. 원격 이미지는 다운로드하지 않는다. 임시 파일은 `tmp/pdfs/`에 만들고 성공 시 정리하며, 생성 중 실패하면 진단을 위해 남긴다.

## 검증

```powershell
node --test .agents/skills/it-readme-pdf/tests/build-readme-pdf.test.mjs
```

생성 후 반드시 다음을 확인한다.

- 실행 로그의 `README + 직접 링크 N개`가 README에서 수집한 고유 로컬 Markdown 집합과 일치한다.
- 페이지 수, 암호화 여부, `SOURCE: <상대경로>` 표식 수, 한글 텍스트를 PDF에서 다시 읽어 확인한다. `pypdf`나 `pdfplumber`를 쓰고, 둘 다 없으면 `pdftotext`로 대체한다.
- 빈 페이지, 잘림, 겹침, 깨진 표·코드·한글이 없는지 시각 검토한다. `pdftoppm`이 있으면 PDF를 직접 래스터화하고, 없으면 `--screenshots`가 만든 PNG를 검토한다.
- 사용할 수 있는 검증 도구가 없으면 해당 항목을 미검증으로 보고하고 PDF 생성 완료로 표현하지 않는다.

## 흔한 실수

| 실수 | 처리 |
| --- | --- |
| 연결 문서의 링크까지 따라감 | 링크 수집은 루트 README에서 정확히 한 번만 수행한다. |
| 합친 파일 위치를 기준으로 이미지를 해석함 | 각 원본 Markdown의 디렉터리를 기준으로 처리한다. |
| 누락 문서를 조용히 생략함 | 전체 생성을 실패시키고 링크를 오류에 표시한다. |
| PDF 파일 존재만 확인함 | 텍스트 검사와 전체 페이지 렌더링을 모두 수행한다. |
| 특정 하네스 전용 도구를 전제함 | 의존성은 `--check-deps`로 먼저 확인하고 없는 검증 도구는 대체 경로를 쓰거나 미검증으로 남긴다. |
| 생성한 PDF·스크린샷을 커밋함 | `output/`과 `tmp/`는 재생성 가능한 산출물이므로 추적하지 않는다. |
