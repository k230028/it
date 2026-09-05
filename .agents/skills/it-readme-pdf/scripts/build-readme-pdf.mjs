import { createRequire } from "node:module";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_OUTPUT = "output/pdf/it-project-portal-readme-direct-links.pdf";
const IMAGE_MIME_TYPES = new Map([
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

let markedModule;

function isExternalHref(href) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href);
}

function withoutQueryOrFragment(href) {
  return href.split(/[?#]/, 1)[0];
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function portableRelative(root, target) {
  return path.relative(root, target).replaceAll("\\", "/");
}

async function importFromNodePath(moduleName, relativeEntrypoint) {
  try {
    return await import(moduleName);
  } catch (error) {
    const roots = (process.env.NODE_PATH ?? "")
      .split(path.delimiter)
      .filter(Boolean);
    for (const root of roots) {
      const candidate = path.join(root, moduleName, relativeEntrypoint);
      try {
        await access(candidate);
        return await import(pathToFileURL(candidate).href);
      } catch {
        // 다음 NODE_PATH 항목을 확인한다.
      }
    }
    throw new Error(
      `${moduleName} 모듈을 찾을 수 없습니다. Codex workspace dependencies의 Node modules 경로를 NODE_PATH에 지정하세요.`,
      { cause: error },
    );
  }
}

async function loadMarked() {
  if (!markedModule) {
    markedModule = await importFromNodePath(
      "marked",
      path.join("lib", "marked.esm.js"),
    );
  }
  return markedModule.marked;
}

export async function extractDirectMarkdownLinks(markdown) {
  const marked = await loadMarked();
  const links = [];
  const tokens = marked.lexer(markdown, { gfm: true });
  marked.walkTokens(tokens, (token) => {
    if (token.type !== "link" || typeof token.href !== "string") {
      return;
    }
    const href = token.href.trim();
    const localPath = withoutQueryOrFragment(href);
    const windowsAbsolutePath = /^[a-z]:[\\/]/i.test(localPath);
    if (
      !href ||
      href.startsWith("#") ||
      (isExternalHref(href) && !windowsAbsolutePath) ||
      ![".md", ".markdown"].includes(path.extname(localPath).toLowerCase())
    ) {
      return;
    }
    links.push(href);
  });
  return links;
}

async function canonicalFile(filePath, workspaceRoot, href) {
  const resolved = path.resolve(filePath);
  if (!isInside(workspaceRoot, resolved)) {
    throw new Error(`워크스페이스 밖의 문서는 포함할 수 없습니다: ${href}`);
  }
  try {
    const canonical = await realpath(resolved);
    if (!isInside(workspaceRoot, canonical)) {
      throw new Error(`워크스페이스 밖의 문서는 포함할 수 없습니다: ${href}`);
    }
    return canonical;
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`직접 연결 문서를 찾을 수 없습니다: ${href}`, {
        cause: error,
      });
    }
    throw error;
  }
}

export async function resolveDirectDocuments(entryPath, workspacePath) {
  const workspaceRoot = await realpath(path.resolve(workspacePath));
  const entry = await canonicalFile(entryPath, workspaceRoot, entryPath);
  const markdown = await readFile(entry, "utf8");
  const hrefs = await extractDirectMarkdownLinks(markdown);
  const documents = [{ path: entry, href: null }];
  const seen = new Set([entry.toLowerCase()]);

  for (const href of hrefs) {
    let decoded;
    try {
      decoded = decodeURIComponent(withoutQueryOrFragment(href));
    } catch (error) {
      throw new Error(`URL 인코딩을 해석할 수 없는 링크입니다: ${href}`, {
        cause: error,
      });
    }
    if (path.isAbsolute(decoded) || /^[a-z]:[\\/]/i.test(decoded)) {
      throw new Error(`절대경로 문서는 포함할 수 없습니다: ${href}`);
    }
    const target = await canonicalFile(
      path.resolve(path.dirname(entry), decoded),
      workspaceRoot,
      href,
    );
    const key = target.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      documents.push({ path: target, href });
    }
  }

  return documents;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function rewriteImageSources(html, sourcePath, workspaceRoot) {
  const imagePattern = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi;
  const matches = [...html.matchAll(imagePattern)];
  let rewritten = html;

  for (const match of matches.reverse()) {
    const [whole, prefix, quote, href] = match;
    if (href.startsWith("data:")) {
      continue;
    }
    if (isExternalHref(href)) {
      const replacement = `${prefix}${quote}${quote}`;
      rewritten =
        rewritten.slice(0, match.index) +
        whole.replace(`${prefix}${quote}${href}${quote}`, replacement) +
        rewritten.slice(match.index + whole.length);
      continue;
    }

    let decoded;
    try {
      decoded = decodeURIComponent(withoutQueryOrFragment(href));
    } catch (error) {
      throw new Error(`${sourcePath}의 이미지 경로를 해석할 수 없습니다: ${href}`, {
        cause: error,
      });
    }
    const imagePath = await canonicalFile(
      path.resolve(path.dirname(sourcePath), decoded),
      workspaceRoot,
      href,
    );
    const mime = IMAGE_MIME_TYPES.get(path.extname(imagePath).toLowerCase());
    if (!mime) {
      throw new Error(`지원하지 않는 이미지 형식입니다: ${href}`);
    }
    const data = await readFile(imagePath);
    const dataUrl = `data:${mime};base64,${data.toString("base64")}`;
    const replacement = `${prefix}${quote}${dataUrl}${quote}`;
    rewritten =
      rewritten.slice(0, match.index) +
      whole.replace(`${prefix}${quote}${href}${quote}`, replacement) +
      rewritten.slice(match.index + whole.length);
  }

  return rewritten;
}

function firstHeading(markdown, fallback) {
  const heading = markdown.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}

async function buildHtml(documents, workspaceRoot, title) {
  const marked = await loadMarked();
  const rendered = [];

  for (const [index, document] of documents.entries()) {
    const markdown = await readFile(document.path, "utf8");
    const relativePath = portableRelative(workspaceRoot, document.path);
    const heading = firstHeading(markdown, relativePath);
    let body = await marked.parse(markdown, { async: true, gfm: true });
    body = await rewriteImageSources(body, document.path, workspaceRoot);
    rendered.push({ index, relativePath, heading, body });
  }

  const toc = rendered
    .map(
      (item) =>
        `<li><a href="#document-${item.index}">${escapeHtml(item.heading)}</a><small>${escapeHtml(item.relativePath)}</small></li>`,
    )
    .join("\n");
  const sections = rendered
    .map(
      (item) => `
<section class="document${item.index === 0 ? " first" : ""}" id="document-${item.index}">
  <div class="document-label">문서 ${item.index + 1} / ${rendered.length}</div>
  <h1 class="document-title">${escapeHtml(item.heading)}</h1>
  <div class="source-path">SOURCE: ${escapeHtml(item.relativePath)}</div>
  <article>${item.body}</article>
</section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  html { color: #172033; font-family: "Malgun Gothic", "Noto Sans KR", sans-serif; font-size: 10.5pt; line-height: 1.6; }
  body { margin: 0; }
  .cover { min-height: 235mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .cover h1 { color: #12203d; font-size: 30pt; line-height: 1.2; margin: 0 0 10mm; }
  .cover p { color: #526078; font-size: 12pt; }
  .toc { page-break-after: always; }
  .toc h2 { border-bottom: 2px solid #2457a7; padding-bottom: 3mm; }
  .toc ol { padding-left: 7mm; }
  .toc li { margin: 0 0 2.2mm; }
  .toc small { color: #718096; display: block; font-family: Consolas, monospace; font-size: 8pt; }
  .toc a { color: #163f7a; text-decoration: none; }
  .document { page-break-before: always; }
  .document.first { page-break-before: auto; }
  .document-label { color: #2457a7; font-size: 8.5pt; font-weight: 700; letter-spacing: .08em; }
  .document-title { color: #12203d; font-size: 23pt; line-height: 1.25; margin: 2mm 0; }
  .source-path { color: #667085; font-family: Consolas, monospace; font-size: 8pt; margin-bottom: 9mm; overflow-wrap: anywhere; }
  article h1 { font-size: 20pt; border-bottom: 2px solid #d8e1ef; padding-bottom: 2mm; }
  article h2 { color: #173b70; font-size: 16pt; border-bottom: 1px solid #d8e1ef; padding-bottom: 1.5mm; margin-top: 9mm; }
  article h3 { color: #234c82; font-size: 13pt; margin-top: 7mm; }
  article h4, article h5, article h6 { color: #344968; }
  a { color: #1356a2; overflow-wrap: anywhere; }
  pre, code { font-family: Consolas, "D2Coding", monospace; }
  code { background: #f0f3f8; border-radius: 3px; padding: .1em .28em; font-size: 8.8pt; }
  pre { background: #111827; color: #e5edf8; border-radius: 6px; padding: 4mm; white-space: pre-wrap; overflow-wrap: anywhere; page-break-inside: avoid; }
  pre code { background: transparent; color: inherit; padding: 0; }
  blockquote { border-left: 3px solid #7aa3d8; color: #526078; margin: 5mm 0; padding: 1mm 0 1mm 5mm; }
  table { border-collapse: collapse; margin: 5mm 0; width: 100%; font-size: 8.7pt; }
  thead { display: table-header-group; }
  th, td { border: 1px solid #b8c4d6; padding: 2mm 2.4mm; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  th { background: #e8eef7; color: #1e3658; }
  tr { page-break-inside: avoid; }
  img { display: block; height: auto; margin: 4mm auto; max-width: 100%; }
  hr { border: 0; border-top: 1px solid #ccd6e4; margin: 8mm 0; }
  p, li { orphans: 3; widows: 3; }
</style>
</head>
<body>
<section class="cover">
  <div class="document-label">IT PROJECT PORTAL</div>
  <h1>${escapeHtml(title)}</h1>
  <p>루트 README와 README가 직접 연결한 로컬 Markdown 문서 ${documents.length - 1}개</p>
</section>
<section class="toc">
  <h2>포함 문서</h2>
  <ol>${toc}</ol>
</section>
${sections}
</body>
</html>`;
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates;
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    const roots = (process.env.NODE_PATH ?? "")
      .split(path.delimiter)
      .filter(Boolean);
    for (const root of roots) {
      try {
        const require = createRequire(path.join(root, "package.json"));
        return require("playwright");
      } catch {
        // 다음 NODE_PATH 항목을 확인한다.
      }
    }
    throw new Error(
      "playwright 모듈을 찾을 수 없습니다. Codex workspace dependencies의 Node modules 경로를 NODE_PATH에 지정하세요.",
      { cause: error },
    );
  }
}

async function launchChromium(chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch (defaultError) {
    for (const executablePath of findBrowserExecutable()) {
      try {
        await access(executablePath);
        return await chromium.launch({ executablePath, headless: true });
      } catch {
        // 다음 브라우저 설치 경로를 확인한다.
      }
    }
    throw new Error("PDF 출력에 사용할 Chromium 또는 Chrome을 실행할 수 없습니다.", {
      cause: defaultError,
    });
  }
}

function parseArguments(argv) {
  const options = {
    entry: "README.md",
    output: DEFAULT_OUTPUT,
    title: "IT Project Portal 문서 모음",
    workspace: process.cwd(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--keep-temp") {
      options.keepTemp = true;
      continue;
    }
    const key = argument.slice(2).replaceAll("-", "");
    if (!["entry", "output", "title", "workspace"].includes(key)) {
      throw new Error(`지원하지 않는 인자입니다: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} 값이 필요합니다.`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

export async function buildReadmePdf(options) {
  const workspaceRoot = await realpath(path.resolve(options.workspace));
  const entryPath = path.resolve(workspaceRoot, options.entry);
  const outputPath = path.resolve(workspaceRoot, options.output);
  if (!isInside(workspaceRoot, outputPath)) {
    throw new Error(`출력 파일은 워크스페이스 안에 있어야 합니다: ${outputPath}`);
  }

  const documents = await resolveDirectDocuments(entryPath, workspaceRoot);
  const html = await buildHtml(documents, workspaceRoot, options.title);
  const tempParent = path.join(workspaceRoot, "tmp", "pdfs");
  await mkdir(tempParent, { recursive: true });
  const tempDirectory = await mkdtemp(path.join(tempParent, "it-readme-pdf-"));
  const htmlPath = path.join(tempDirectory, "bundle.html");
  const tempPdfPath = path.join(tempDirectory, "bundle.pdf");
  await writeFile(htmlPath, html, "utf8");

  const { chromium } = await loadPlaywright();
  const browser = await launchChromium(chromium);
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({
      path: tempPdfPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font-size:8px;color:#718096;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: "18mm", right: "16mm", bottom: "20mm", left: "16mm" },
    });
    await context.close();
  } finally {
    await browser.close();
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await copyFile(tempPdfPath, outputPath);
  if (!options.keepTemp) {
    await rm(tempDirectory, { recursive: true, force: true });
  }

  return {
    documents: documents.map((item) => portableRelative(workspaceRoot, item.path)),
    outputPath,
    tempDirectory: options.keepTemp ? tempDirectory : null,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await buildReadmePdf(options);
  console.log(`PDF 생성: ${result.outputPath}`);
  console.log(`포함 문서: ${result.documents.length}개 (README + 직접 링크 ${result.documents.length - 1}개)`);
  for (const document of result.documents) {
    console.log(`- ${document}`);
  }
  if (result.tempDirectory) {
    console.log(`임시 파일: ${result.tempDirectory}`);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
