import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  extractDirectMarkdownLinks,
  resolveDirectDocuments,
} from "../scripts/build-readme-pdf.mjs";

test("extractDirectMarkdownLinks는 직접 로컬 Markdown 링크만 원래 순서로 반환한다", async () => {
  const markdown = [
    "[A](docs/a.md)",
    "[외부](https://example.com/b.md)",
    "![이미지](docs/image.png)",
    "[앵커](#section)",
    "[B](docs/b.MD#details)",
    "[A 중복](./docs/a.md#again)",
    "`[인라인 코드](docs/code.md)`",
    "```markdown",
    "[코드 블록](docs/fenced.md)",
    "```",
  ].join("\n");

  assert.deepEqual(await extractDirectMarkdownLinks(markdown), [
    "docs/a.md",
    "docs/b.MD#details",
    "./docs/a.md#again",
  ]);
});

test("resolveDirectDocuments는 README 자신과 직접 링크만 포함하고 재귀 추적하지 않는다", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "it-readme-pdf-"));
  const docs = path.join(root, "docs");
  await mkdir(docs);
  await writeFile(
    path.join(root, "README.md"),
    "# Root\n\n[A](docs/a.md)\n\n[A again](docs/a.md#part)\n",
    "utf8",
  );
  await writeFile(path.join(docs, "a.md"), "# A\n\n[B](b.md)\n", "utf8");
  await writeFile(path.join(docs, "b.md"), "# B\n", "utf8");

  const result = await resolveDirectDocuments(
    path.join(root, "README.md"),
    root,
  );

  assert.deepEqual(
    result.map((item) => path.relative(root, item.path).replaceAll("\\", "/")),
    ["README.md", "docs/a.md"],
  );
});

test("resolveDirectDocuments는 누락 파일을 조용히 생략하지 않는다", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "it-readme-pdf-"));
  await writeFile(
    path.join(root, "README.md"),
    "# Root\n\n[Missing](docs/missing.md)\n",
    "utf8",
  );

  await assert.rejects(
    resolveDirectDocuments(path.join(root, "README.md"), root),
    /직접 연결 문서를 찾을 수 없습니다/,
  );
});

test("resolveDirectDocuments는 워크스페이스 밖 경로를 거부한다", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "it-readme-pdf-"));
  const root = path.join(parent, "workspace");
  await mkdir(root);
  await writeFile(path.join(parent, "outside.md"), "# Outside\n", "utf8");
  await writeFile(
    path.join(root, "README.md"),
    "# Root\n\n[Outside](../outside.md)\n",
    "utf8",
  );

  await assert.rejects(
    resolveDirectDocuments(path.join(root, "README.md"), root),
    /워크스페이스 밖의 문서는 포함할 수 없습니다/,
  );
});

test("resolveDirectDocuments는 Windows 절대 Markdown 경로를 외부 URL로 오인하지 않는다", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "it-readme-pdf-"));
  await writeFile(
    path.join(root, "README.md"),
    "# Root\n\n[Absolute](C:/outside/absolute.md)\n",
    "utf8",
  );

  await assert.rejects(
    resolveDirectDocuments(path.join(root, "README.md"), root),
    /절대경로 문서는 포함할 수 없습니다/,
  );
});
