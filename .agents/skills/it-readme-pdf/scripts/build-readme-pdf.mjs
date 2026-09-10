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
// 표지와 머리말·꼬리말에 넣는 브랜딩 이미지. 워크스페이스 기준 상대 경로다.
const BRAND_ASSETS = {
  cover: "it_frontend/app/assets/logo_rm.png",
  headerLeft: "it_frontend/app/assets/kdb-ci.png",
  footerRight: "it_frontend/app/assets/kdb-ci2.png",
};
const COVER_SUBTITLE = "운영 및 개발 가이드";
const COVER_DESCRIPTION = "README, CLAUDE/AGENTS 지침, GUIDE 문서 등";
const IMAGE_MIME_TYPES = new Map([
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

let markedModule;

// 스크립트 위치(<repo>/.agents/skills/it-readme-pdf/scripts)에서 저장소 루트를 역산한다.
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..", "..", "..", "..");

/**
 * 의존 모듈을 찾을 후보 디렉터리를 반환한다.
 * NODE_PATH를 우선 사용하고, 지정되지 않은 하네스에서는 저장소 안의 기존 설치본으로 대체한다.
 */
function moduleSearchRoots() {
  const fromEnvironment = (process.env.NODE_PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  const fallbacks = [
    // 스킬 전용 의존성(marked). `.agents/skills/it-readme-pdf`에서 npm install로 설치한다.
    path.resolve(SCRIPT_DIRECTORY, "..", "node_modules"),
    // playwright와 Chromium은 프론트엔드 저장소의 기존 설치본을 재사용한다.
    path.join(REPOSITORY_ROOT, "it_frontend", "node_modules"),
  ];
  return [...fromEnvironment, ...fallbacks];
}

function missingModuleMessage(moduleName) {
  return [
    `${moduleName} 모듈을 찾을 수 없습니다.`,
    `${moduleName}가 설치된 Node modules 디렉터리를 NODE_PATH에 지정하세요.`,
    `탐색한 경로: ${moduleSearchRoots().join(path.delimiter) || "(없음)"}`,
  ].join(" ");
}

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
    for (const root of moduleSearchRoots()) {
      const candidate = path.join(root, moduleName, relativeEntrypoint);
      try {
        await access(candidate);
        return await import(pathToFileURL(candidate).href);
      } catch {
        // 다음 탐색 경로를 확인한다.
      }
    }
    throw new Error(missingModuleMessage(moduleName), { cause: error });
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
  if (!heading) {
    return fallback;
  }
  // 목차가 자체 번호를 매기므로 "1. 프로젝트와 저장소"처럼 소제목에 박힌 앞 번호는 뗀다.
  return heading.replace(/^\d+(?:\.\d+)*\.?\s+/, "") || heading;
}

/**
 * 표지와 머리말·꼬리말에 넣는 브랜딩 이미지를 data URI로 읽는다.
 * 누락·워크스페이스 밖·지원하지 않는 형식은 본문 이미지와 같은 기준으로 생성을 실패시킨다.
 */
async function loadBrandAssets(workspaceRoot) {
  const entries = [];
  for (const [key, relativePath] of Object.entries(BRAND_ASSETS)) {
    let assetPath;
    try {
      assetPath = await canonicalFile(
        path.resolve(workspaceRoot, relativePath),
        workspaceRoot,
        relativePath,
      );
    } catch (error) {
      throw new Error(`브랜딩 이미지를 찾을 수 없습니다: ${relativePath}`, { cause: error });
    }
    const mime = IMAGE_MIME_TYPES.get(path.extname(assetPath).toLowerCase());
    if (!mime) {
      throw new Error(`지원하지 않는 브랜딩 이미지 형식입니다: ${relativePath}`);
    }
    const data = await readFile(assetPath);
    entries.push([key, `data:${mime};base64,${data.toString("base64")}`]);
  }
  return Object.fromEntries(entries);
}

/**
 * 생성한 PDF 바이트에서 페이지 수를 센다.
 * 목차 쪽수를 실제 페이지와 대조하는 용도이며, 세지 못하면 잘못된 쪽수를 내보내지 않고 실패한다.
 */
function countPdfPages(buffer) {
  const raw = Buffer.isBuffer(buffer) ? buffer.toString("latin1") : String(buffer);
  const count = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  if (count < 1) {
    throw new Error("생성한 PDF에서 페이지 수를 읽지 못했습니다.");
  }
  return count;
}

/** Chromium 머리말·꼬리말은 본문과 다른 문서로 렌더링되므로 스타일과 이미지를 인라인으로 넣는다. */
function headerTemplate(brand) {
  return `<div style="box-sizing:border-box;font-size:8px;margin:0;padding:1mm 16mm 0;width:100%"><img src="${brand.headerLeft}" style="display:block;height:13px;width:73px"></div>`;
}

function footerTemplate(brand) {
  return `<div style="align-items:flex-end;box-sizing:border-box;color:#718096;display:flex;font-size:8px;justify-content:space-between;margin:0;padding:0 16mm 7mm;width:100%"><span style="flex:0 0 73px"></span><span style="flex:1 1 auto;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></span><img src="${brand.footerRight}" style="display:block;flex:0 0 auto;height:13px;width:73px"></div>`;
}

/**
 * 각 Markdown을 HTML 본문으로 바꾸고 목차·본문이 함께 쓰는 메타데이터를 만든다.
 */
async function renderDocuments(documents, workspaceRoot) {
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

  return rendered;
}

function coverSection(brand, title) {
  return `<section class="cover">
  <img class="cover-logo" src="${brand.cover}" alt="">
  <h1>${escapeHtml(title)}</h1>
  <p class="cover-subtitle">${escapeHtml(COVER_SUBTITLE)}</p>
  <p class="cover-note">${escapeHtml(COVER_DESCRIPTION)}</p>
</section>`;
}

/**
 * 목차를 만든다. startPages를 주지 않으면 쪽수 자리를 비운 예비 목차가 나온다.
 */
function tocSection(rendered, startPages) {
  const items = rendered
    .map((item, order) => {
      const page = startPages?.[order];
      const label = page ? `${page}페이지` : "";
      return `<li><a class="toc-row" href="#document-${item.index}"><span class="toc-name">${escapeHtml(item.heading)}</span><span class="toc-dots"></span><span class="toc-page">${escapeHtml(label)}</span></a><small>${escapeHtml(item.relativePath)}</small></li>`;
    })
    .join("\n");
  return `<section class="toc">
  <h2>목차</h2>
  <ol>${items}</ol>
</section>`;
}

function documentSection(item, total) {
  return `<section class="document${item.index === 0 ? " first" : ""}" id="document-${item.index}">
  <div class="document-label">문서 ${item.index + 1} / ${total}</div>
  <h1 class="document-title">${escapeHtml(item.heading)}</h1>
  <div class="source-path">SOURCE: ${escapeHtml(item.relativePath)}</div>
  <article>${item.body}</article>
</section>`;
}

/**
 * 인쇄용 HTML을 조립한다.
 * mode "front"는 표지·목차만, "document"는 쪽수를 재기 위해 문서 하나만 담는다.
 */
function composeHtml({ rendered, brand, startPages, title, mode = "all", document: single }) {
  const total = rendered.length;
  const front = `${coverSection(brand, title)}\n${tocSection(rendered, startPages)}`;
  let body;
  if (mode === "front") {
    body = front;
  } else if (mode === "document") {
    body = documentSection(single, total);
  } else {
    body = `${front}\n${rendered.map((item) => documentSection(item, total)).join("\n")}`;
  }
  // 문서 하나만 렌더링할 때는 앞의 강제 개면을 없애야 합본에서의 쪽수와 같아진다.
  const measureStyle =
    mode === "document" ? "\n  .document, .document.first { page-break-before: auto; }" : "";

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${escapeHtml(`${title} ${COVER_SUBTITLE}`)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  html { color: #172033; font-family: "Malgun Gothic", "Noto Sans KR", sans-serif; font-size: 10.5pt; line-height: 1.6; }
  body { margin: 0; }
  .cover { min-height: 235mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .cover-logo { display: block; height: 34mm; margin: 0 0 14mm; width: 34mm; }
  .cover h1 { color: #12203d; font-size: 34pt; line-height: 1.2; margin: 0 0 3mm; }
  .cover-subtitle { color: #1b4a8c; font-size: 18pt; font-weight: 700; margin: 0 0 9mm; }
  .cover-note { border-top: 1px solid #ccd6e4; color: #526078; font-size: 11pt; margin: 0; padding-top: 5mm; }
  .toc { page-break-after: always; }
  .toc h2 { border-bottom: 2px solid #2457a7; padding-bottom: 3mm; }
  .toc ol { padding-left: 7mm; }
  .toc li { margin: 0 0 1.2mm; page-break-inside: avoid; break-inside: avoid; }
  .toc small { color: #718096; display: block; font-family: Consolas, monospace; font-size: 8pt; line-height: 1.35; }
  .toc a { color: #163f7a; text-decoration: none; }
  .toc-row { align-items: baseline; display: flex; gap: 1.5mm; }
  .toc-name { flex: 0 1 auto; }
  .toc-dots { align-self: flex-end; border-bottom: 1px dotted #9aa7bb; flex: 1 1 auto; height: 0; margin-bottom: 1.2mm; min-width: 6mm; }
  .toc-page { color: #526078; flex: 0 0 auto; font-size: 9.5pt; white-space: nowrap; }
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
  p, li { orphans: 3; widows: 3; }${measureStyle}
</style>
</head>
<body>
${body}
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
    for (const root of moduleSearchRoots()) {
      try {
        const require = createRequire(path.join(root, "package.json"));
        return require("playwright");
      } catch {
        // 다음 탐색 경로를 확인한다.
      }
    }
    throw new Error(missingModuleMessage("playwright"), { cause: error });
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
    title: "IT정보화포탈",
    workspace: process.cwd(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--keep-temp") {
      options.keepTemp = true;
      continue;
    }
    if (argument === "--check-deps") {
      options.checkDependenciesOnly = true;
      continue;
    }
    const key = argument.slice(2).replaceAll("-", "");
    if (!["entry", "output", "title", "workspace", "screenshots"].includes(key)) {
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

/**
 * 인쇄 레이아웃을 A4 비율 뷰포트로 잘라 PNG로 저장한다.
 * PDF 래스터라이저(pdftoppm 등)가 없는 하네스에서 시각 검토 경로를 제공한다.
 * 반환값은 저장한 PNG 경로 목록이다.
 */
async function captureLayoutScreenshots(page, targetDirectory) {
  const pageWidth = 1240;
  const pageHeight = 1754;
  await page.setViewportSize({ width: pageWidth, height: pageHeight });
  const totalHeight = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await mkdir(targetDirectory, { recursive: true });
  const captured = [];
  const sliceCount = Math.max(1, Math.ceil(totalHeight / pageHeight));
  for (let index = 0; index < sliceCount; index += 1) {
    const top = index * pageHeight;
    const height = Math.min(pageHeight, totalHeight - top);
    if (height <= 0) {
      break;
    }
    const filePath = path.join(
      targetDirectory,
      `page-${String(index + 1).padStart(3, "0")}.png`,
    );
    await page.screenshot({
      path: filePath,
      fullPage: true,
      clip: { x: 0, y: top, width: pageWidth, height },
    });
    captured.push(filePath);
  }
  return captured;
}

/**
 * 문서 수집과 임시 파일 생성 전에 marked·playwright와 Chromium 실행 가능 여부를 확인한다.
 * 하네스마다 의존성 제공 방식이 달라 실패를 초기에 드러내야 한다.
 */
export async function ensureDependencies() {
  await loadMarked();
  const { chromium } = await loadPlaywright();
  const browser = await launchChromium(chromium);
  await browser.close();
}

export async function buildReadmePdf(options) {
  const workspaceRoot = await realpath(path.resolve(options.workspace));
  const entryPath = path.resolve(workspaceRoot, options.entry);
  const outputPath = path.resolve(workspaceRoot, options.output);
  if (!isInside(workspaceRoot, outputPath)) {
    throw new Error(`출력 파일은 워크스페이스 안에 있어야 합니다: ${outputPath}`);
  }

  await ensureDependencies();

  const documents = await resolveDirectDocuments(entryPath, workspaceRoot);
  const brand = await loadBrandAssets(workspaceRoot);
  const rendered = await renderDocuments(documents, workspaceRoot);
  const tempParent = path.join(workspaceRoot, "tmp", "pdfs");
  await mkdir(tempParent, { recursive: true });
  const tempDirectory = await mkdtemp(path.join(tempParent, "it-readme-pdf-"));
  const htmlPath = path.join(tempDirectory, "bundle.html");
  const tempPdfPath = path.join(tempDirectory, "bundle.pdf");

  let screenshots = [];
  let startPages = [];
  const { chromium } = await loadPlaywright();
  const browser = await launchChromium(chromium);
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.route("**/*", (route) => route.abort());
    const pdfOptions = {
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: headerTemplate(brand),
      footerTemplate: footerTemplate(brand),
      margin: { top: "18mm", right: "16mm", bottom: "20mm", left: "16mm" },
    };
    const renderPdf = async (markup) => {
      await page.setContent(markup, { waitUntil: "load" });
      return await page.pdf(pdfOptions);
    };

    // 문서는 언제나 새 페이지에서 시작하므로 개별 렌더의 쪽수가 합본에서의 쪽수와 같다.
    const documentPageCounts = [];
    for (const item of rendered) {
      const markup = composeHtml({
        rendered,
        brand,
        title: options.title,
        mode: "document",
        document: item,
      });
      documentPageCounts.push(countPdfPages(await renderPdf(markup)));
    }

    // 목차 쪽수는 앞부분(표지·목차) 분량에 의존하므로 값이 고정될 때까지 되풀이한다.
    let frontPages = 2;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      startPages = [];
      let cursor = frontPages + 1;
      for (const count of documentPageCounts) {
        startPages.push(cursor);
        cursor += count;
      }
      const markup = composeHtml({
        rendered,
        brand,
        startPages,
        title: options.title,
        mode: "front",
      });
      const actual = countPdfPages(await renderPdf(markup));
      if (actual === frontPages) {
        break;
      }
      frontPages = actual;
    }

    const html = composeHtml({ rendered, brand, startPages, title: options.title });
    const buffer = await renderPdf(html);
    const totalPages = countPdfPages(buffer);
    const expectedPages = frontPages + documentPageCounts.reduce((sum, count) => sum + count, 0);
    if (totalPages !== expectedPages) {
      throw new Error(
        `목차에 적은 쪽수가 실제 페이지 수와 어긋납니다: 예상 ${expectedPages}, 실제 ${totalPages}`,
      );
    }
    await writeFile(tempPdfPath, buffer);
    await writeFile(htmlPath, html, "utf8");
    if (options.screenshots) {
      const screenshotDirectory = path.resolve(workspaceRoot, options.screenshots);
      if (!isInside(workspaceRoot, screenshotDirectory)) {
        throw new Error(
          `스크린샷 디렉터리는 워크스페이스 안에 있어야 합니다: ${screenshotDirectory}`,
        );
      }
      screenshots = await captureLayoutScreenshots(page, screenshotDirectory);
    }
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
    startPages,
    outputPath,
    screenshots: screenshots.map((item) => portableRelative(workspaceRoot, item)),
    tempDirectory: options.keepTemp ? tempDirectory : null,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.checkDependenciesOnly) {
    await ensureDependencies();
    console.log("의존성 확인 완료: marked, playwright, Chromium 실행 가능");
    return;
  }
  const result = await buildReadmePdf(options);
  console.log(`PDF 생성: ${result.outputPath}`);
  console.log(`포함 문서: ${result.documents.length}개 (README + 직접 링크 ${result.documents.length - 1}개)`);
  for (const document of result.documents) {
    console.log(`- ${document}`);
  }
  if (result.screenshots.length > 0) {
    console.log(`레이아웃 스크린샷: ${result.screenshots.length}장`);
    console.log(`- ${path.dirname(result.screenshots[0])}`);
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
