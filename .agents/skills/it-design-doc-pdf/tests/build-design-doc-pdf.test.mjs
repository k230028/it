import assert from "node:assert/strict";
import test from "node:test";
import { renderFlow, splitDocument, validateDocument } from "../scripts/build-design-doc-pdf.mjs";

const SAMPLE = `# 분석/설계서

## 주요내용

### [요청자 정보]

| 항목 | 내용 |
| --- | --- |
| 요청일자 | 2026-09-14 |
| 요청부서 | IT기획부 |
| 요청문서번호 | (미기재) |
| 요청자명 | 홍길동 차장 |

※ 요청자 정보는 PRD 기준.

### [작성자 정보]

| 항목 | 내용 |
| --- | --- |
| 작성일자 | 2026-09-15 |
| 작성자명 | 김철수 |

### [분석/설계 내용]

#### 1. 배경 및 개요

- (수집 구간) 2026-09-14 00:00 ~ 2026-09-15 17:20, 저장소 root

#### 4. 테스트 시나리오 (총 2건)

| TEST ID | 시나리오명 | 구분 | 점검 포인트 | 예상결과 |
| --- | --- | --- | --- | --- |
| **TC-01** | A | Vitest | \`GET /api/projects/{id}\` | ok |
| TC-02 | B | 사용자 | 화면 | ok |
`;

test("제목·요청자·작성자·주석을 본문에서 분리한다", () => {
  const parts = splitDocument(SAMPLE);
  assert.equal(parts.title, "분석/설계서");
  assert.deepEqual(
    parts.requester.map((e) => e.key),
    ["요청일자", "요청부서", "요청문서번호", "요청자명"],
  );
  assert.equal(parts.author.find((e) => e.key === "작성자명").value, "김철수");
  assert.deepEqual(parts.notes, ["요청자 정보는 PRD 기준."]);
  assert.ok(!parts.body.includes("[요청자 정보]"));
  assert.ok(!parts.body.includes("## 주요내용"));
  assert.ok(parts.body.startsWith("### [분석/설계 내용]"));
});

test("정상 문서는 검증을 통과하고 API 경로 변수는 자리표시자로 보지 않는다", () => {
  const parts = splitDocument(SAMPLE);
  assert.deepEqual(validateDocument(SAMPLE, parts), []);
});

test("시나리오 건수 불일치와 남은 자리표시자를 보고한다", () => {
  const broken = SAMPLE.replace("(총 2건)", "(총 3건)").replace("김철수", "{성명 또는 git user.name}");
  const problems = validateDocument(broken, splitDocument(broken));
  assert.equal(problems.length, 2);
  assert.match(problems[0], /자리표시자/);
  assert.match(problems[1], /총 3건이나 표 행은 2건/);
});

test("요청자 표가 없으면 검증에 실패한다", () => {
  const withoutRequester = SAMPLE.replace(/### \[요청자 정보\][\s\S]*?(?=### \[작성자 정보\])/, "");
  const problems = validateDocument(withoutRequester, splitDocument(withoutRequester));
  assert.ok(problems.some((p) => p.includes("[요청자 정보]")));
});

test("개요 도식은 가지 줄을 2열로, 상자 줄을 가로지르는 줄로 그린다", () => {
  const html = renderFlow("[요청 5건]\n      │\n      ├─ ① 예산 목록   : 팀 토글 · 연도 안내\n      └─ ② 공통 기반   : 세션 충돌\n[효과] 찾기 쉬움");
  assert.equal((html.match(/flow-branch/g) ?? []).length, 2);
  assert.equal((html.match(/flow-box/g) ?? []).length, 2);
  assert.ok(html.includes('<span class="flow-items">팀 토글 · 연도 안내</span>'));
  assert.ok(html.includes("① 예산 목록</span>"));
});