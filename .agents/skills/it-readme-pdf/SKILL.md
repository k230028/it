---
name: it-readme-pdf
description: Use when generating a single PDF from this IT Portal project's root README and only the local Markdown documents linked directly from that README.
---

# IT Portal README PDF

## 핵심 계약

루트 `README.md` 본문과 README가 직접 연결한 로컬 `.md`·`.markdown` 문서만 하나의 PDF로 만든다. 링크된 문서에서 다른 문서를 재귀 탐색하지 않는다.

**REQUIRED SUB-SKILL:** PDF를 만들고 검증할 때 `pdf` 스킬을 적용한다.

## 실행

1. 루트 `CLAUDE.md`와 현재 Git 변경을 확인한다.
2. Codex workspace dependencies를 불러와 반환된 Node 실행 파일과 Node modules 경로를 사용한다.
3. Node modules 경로를 `NODE_PATH`에 설정하고 루트에서 다음 스크립트를 실행한다.

```powershell
& $workspaceNode .agents/skills/it-readme-pdf/scripts/build-readme-pdf.mjs `
  --entry README.md `
  --workspace . `
  --output output/pdf/it-project-portal-readme-direct-links.pdf
```

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
& $workspaceNode --test .agents/skills/it-readme-pdf/tests/build-readme-pdf.test.mjs
```

생성 후 반드시 다음을 확인한다.

- 실행 로그의 `README + 직접 링크 N개`가 README에서 수집한 고유 로컬 Markdown 집합과 일치한다.
- `pypdf` 또는 `pdfplumber`로 PDF를 다시 열고 페이지 수, 암호화 여부, 모든 `SOURCE: <상대경로>` 표식과 한글 텍스트를 확인한다.
- `pdftoppm`으로 전체 페이지를 PNG로 렌더링하고 빈 페이지, 잘림, 겹침, 깨진 표·코드·한글이 없는지 시각 검토한다.
- 실패하면 PDF 생성 완료로 보고하지 않는다.

## 흔한 실수

| 실수 | 처리 |
| --- | --- |
| 연결 문서의 링크까지 따라감 | 링크 수집은 루트 README에서 정확히 한 번만 수행한다. |
| 합친 파일 위치를 기준으로 이미지를 해석함 | 각 원본 Markdown의 디렉터리를 기준으로 처리한다. |
| 누락 문서를 조용히 생략함 | 전체 생성을 실패시키고 링크를 오류에 표시한다. |
| PDF 파일 존재만 확인함 | 텍스트 검사와 전체 페이지 렌더링을 모두 수행한다. |
