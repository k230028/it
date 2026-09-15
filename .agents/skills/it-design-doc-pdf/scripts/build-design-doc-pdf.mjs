// 분석/설계서 Markdown(docs/design-docs/*.md)을 공문서 디자인이 적용된 A4 PDF로 변환한다.
// 의존성: marked(it-readme-pdf 스킬 설치본), playwright·pdfjs-dist(it_frontend 설치본), Chromium.
import { createRequire } from "node:module";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..", "..", "..", "..");

// 브랜딩 이미지와 글꼴. 워크스페이스 기준 상대 경로이며 data URI로 포함한다.
const BRAND = {
  headerLeft: "it_frontend/app/assets/kdb-ci.png",
  footerRight: "it_frontend/app/assets/kdb-ci2.png",
};
const FONTS = [
  { family: "KDBGothic", weight: 400, file: "it_frontend/app/assets/fonts/KDBGothic-Regular.woff2" },
  { family: "KDBGothic", weight: 500, file: "it_frontend/app/assets/fonts/KDBGothic-Medium.woff2" },
  { family: "KDBGothic", weight: 700, file: "it_frontend/app/assets/fonts/KDBGothic-Bold.woff2" },
  { family: "NotoSansKR", weight: 400, file: "it_frontend/app/assets/fonts/NotoSansKR-Regular.woff2" },
  { family: "NotoSansKR", weight: 500, file: "it_frontend/app/assets/fonts/NotoSansKR-Medium.woff2" },
  { family: "NotoSansKR", weight: 700, file: "it_frontend/app/assets/fonts/NotoSansKR-Bold.woff2" },
];
const ORGANIZATION = "IT정보화포탈";
const REQUESTER_SECTION = "[요청자 정보]";
const AUTHOR_SECTION = "[작성자 정보]";

function moduleSearchRoots() {
  const fromEnvironment = (process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean);
  return [
    ...fromEnvironment,
    path.resolve(SCRIPT_DIRECTORY, "..", "node_modules"),
    path.resolve(SCRIPT_DIRECTORY, "..", "..", "it-readme-pdf", "node_modules"),
    path.join(REPOSITORY_ROOT, "it_frontend", "node_modules"),
  ];
}

function missingModuleMessage(moduleName) {
  return `${moduleName} 모듈을 찾을 수 없습니다. 탐색 경로: ${moduleSearchRoots().join(path.delimiter)}`;
}

async function importFromSearchRoots(moduleName, relativeEntrypoint) {
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

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    for (const root of moduleSearchRoots()) {
      try {
        return createRequire(path.join(root, "package.json"))("playwright");
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
    const candidates = [
      process.env.CHROME_PATH,
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ].filter(Boolean);
    for (const executablePath of candidates) {
      try {
        await access(executablePath);
        return await chromium.launch({ executablePath, headless: true });
      } catch {
        // 다음 브라우저 설치 경로를 확인한다.
      }
    }
    throw new Error("PDF 출력에 사용할 Chromium 또는 Chrome을 실행할 수 없습니다.", { cause: defaultError });
  }
}

async function toDataUri(workspaceRoot, relativePath, mime) {
  const buffer = await readFile(path.resolve(workspaceRoot, relativePath));
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** `| 항목 | 값 |` 형식의 표 본문에서 항목→값 쌍을 읽는다. 헤더·구분선은 건너뛴다. */
function parseKeyValueTable(lines) {
  const entries = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
    if (cells.length < 2 || cells[0] === "항목" || /^:?-+:?$/.test(cells[0])) continue;
    entries.push({ key: cells[0], value: cells[1] });
  }
  return entries;
}

/**
 * Markdown을 제목·기본정보(요청자/작성자)·본문으로 나눈다.
 * 요청자·작성자 절은 표 두 개를 나란히 둔 공문서 기본정보 상자로 렌더하기 위해 본문에서 분리한다.
 */
export function splitDocument(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let title = "분석/설계서";
  const body = [];
  const sections = { [REQUESTER_SECTION]: [], [AUTHOR_SECTION]: [] };
  const notes = [];
  let current = null;
  let titleTaken = false;

  for (const line of lines) {
    if (!titleTaken && /^# /.test(line)) {
      title = line.slice(2).trim();
      titleTaken = true;
      continue;
    }
    const heading = line.match(/^(#{2,6})\s+(.*)$/);
    if (heading) {
      const text = heading[2].trim();
      if (text === REQUESTER_SECTION || text === AUTHOR_SECTION) {
        current = text;
        continue;
      }
      current = null;
    }
    if (current) {
      if (line.trim().startsWith("※")) notes.push(line.trim().replace(/^※\s*/, ""));
      else sections[current].push(line);
      continue;
    }
    body.push(line);
  }

  return {
    title,
    requester: parseKeyValueTable(sections[REQUESTER_SECTION]),
    author: parseKeyValueTable(sections[AUTHOR_SECTION]),
    notes,
    body: body.join("\n").replace(/^## 주요내용\s*$/m, "").trim(),
  };
}

/** 사용자 수정 후에도 양식 계약이 깨지지 않았는지 확인한다. 위반은 목록으로 돌려준다. */
export function validateDocument(markdown, parts) {
  const problems = [];
  // 템플릿 자리표시자만 잡는다. `/api/projects/{id}` 같은 API 경로 변수는 대상이 아니다.
  if (/\{(YY[^}\n]*|…|N|n|[^}\n]*[가-힣][^}\n]*)\}/.test(markdown)) {
    problems.push("템플릿 자리표시자 `{…}`가 남아 있습니다.");
  }
  const scenarioHeading = markdown.match(/^#{3,5}\s+.*테스트 시나리오\s*\(총\s*(\d+)\s*건\)/m);
  if (scenarioHeading) {
    const declared = Number(scenarioHeading[1]);
    const rows = (markdown.match(/^\|\s*\**TC-\d+/gm) ?? []).length;
    if (declared !== rows) {
      problems.push(`테스트 시나리오 제목은 총 ${declared}건이나 표 행은 ${rows}건입니다.`);
    }
  } else {
    problems.push("`테스트 시나리오 (총 N건)` 제목을 찾지 못했습니다.");
  }
  if (parts.requester.length === 0) problems.push(`${REQUESTER_SECTION} 표가 비어 있습니다.`);
  if (parts.author.length === 0) problems.push(`${AUTHOR_SECTION} 표가 비어 있습니다.`);
  return problems;
}

function infoBox(parts, marked) {
  const inline = (text) => marked.parseInline(text);
  const rows = (entries) =>
    entries.map((e) => `<tr><th>${escapeHtml(e.key)}</th><td>${inline(e.value)}</td></tr>`).join("");
  const notes = parts.notes.length
    ? `<ul class="info-notes">${parts.notes.map((n) => `<li>${inline(n)}</li>`).join("")}</ul>`
    : "";
  return `
<section class="info-box">
  <div class="info-col">
    <div class="info-caption">요청자 정보</div>
    <table class="info-table">${rows(parts.requester)}</table>
  </div>
  <div class="info-col">
    <div class="info-caption">작성자 정보</div>
    <table class="info-table">${rows(parts.author)}</table>
  </div>
</section>${notes}`;
}

/**
 * 개요 도식(```flow)을 2열 격자로 그린다. `가지 : 키워드` 줄은 가지·키워드 두 칸으로 나눠
 * 글꼴과 무관하게 콜론 열이 맞고, 그 밖의 줄(요청·효과 상자, 세로선)은 두 열을 가로지른다.
 */
export function renderFlow(text) {
  const rows = text.replace(/\r\n/g, "\n").split("\n").map((line) => {
    const branch = line.match(/^(\s*[├└]─\s*.+?)\s+:\s+(.+)$/);
    if (branch) {
      return `<span class="flow-branch">${escapeHtml(branch[1])}</span><span class="flow-items">${escapeHtml(branch[2])}</span>`;
    }
    const boxed = /^\s*\[.+\]/.test(line);
    return `<span class="flow-line${boxed ? " flow-box" : ""}">${escapeHtml(line)}</span>`;
  });
  return `<div class="flow">${rows.join("")}</div>`;
}

function findValue(entries, key) {
  return entries.find((e) => e.key === key)?.value ?? "";
}

function deriveSubtitle(markdown) {
  // `**(수집 구간)** 2026-09-14 00:00 ~ 2026-09-15 18:16 · 커밋 …`에서 시각 범위만 뽑는다
  const range = markdown.match(/\(수집 구간\)\**\s*([^·,\n]+)/);
  return range ? `수정분 기준 ${range[1].trim()}` : "";
}

function styles(fontFaces) {
  return `
${fontFaces}
@page { size: A4; margin: 20mm 16mm 20mm; }
* { box-sizing: border-box; }
html { color: #1b2433; font-family: "NotoSansKR", "Malgun Gothic", sans-serif; font-size: 10pt; line-height: 1.55; word-break: keep-all; }
body { margin: 0; }
code { font-family: Consolas, "Courier New", monospace; font-size: 0.88em; background: #f3f5f9; border-radius: 2px; padding: 0 2px; overflow-wrap: anywhere; }
a { color: inherit; text-decoration: none; }

.title-band { border-top: 3px solid #0b2f6b; border-bottom: 1px solid #0b2f6b; padding: 5mm 0 4mm; margin-bottom: 6mm; display: flex; justify-content: space-between; align-items: flex-end; }
.title-band .org { font-family: "KDBGothic", "NotoSansKR", sans-serif; font-size: 9pt; color: #4c5a72; letter-spacing: .08em; margin-bottom: 1.5mm; }
.title-band h1 { font-family: "KDBGothic", "NotoSansKR", sans-serif; font-size: 26pt; font-weight: 700; color: #0b2f6b; margin: 0; line-height: 1.2; letter-spacing: .04em; }
.title-band .subtitle { font-size: 10pt; color: #33415c; margin-top: 2mm; }
.title-band .meta { text-align: right; font-size: 9pt; color: #4c5a72; line-height: 1.7; }
.title-band .meta b { color: #1b2433; font-weight: 500; }

.info-box { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin: 0 0 3mm; }
.info-caption { font-family: "KDBGothic", "NotoSansKR", sans-serif; font-size: 9.5pt; font-weight: 700; color: #0b2f6b; margin-bottom: 1.5mm; }
.info-table { border-collapse: collapse; width: 100%; font-size: 9.5pt; }
.info-table th, .info-table td { border: 1px solid #b9c5d8; padding: 1.6mm 2.5mm; text-align: left; vertical-align: middle; }
.info-table th { background: #eaf0f8; font-weight: 500; width: 32%; color: #23324d; }
.info-notes { font-size: 8.5pt; color: #5b6880; margin: 0 0 6mm; padding-left: 4mm; }
.info-notes > li::before { content: "※"; color: #5b6880; font-size: 1em; top: 0; }

h2 { font-family: "KDBGothic", "NotoSansKR", sans-serif; font-size: 13pt; color: #fff; background: #0b2f6b; padding: 2mm 4mm; margin: 8mm 0 4mm; page-break-after: avoid; break-after: avoid; }
h3 { font-family: "KDBGothic", "NotoSansKR", sans-serif; font-size: 12.5pt; color: #0b2f6b; border-left: 4px solid #0b2f6b; background: #eef2f9; padding: 1.8mm 3mm; margin: 7mm 0 3.5mm; page-break-after: avoid; break-after: avoid; }
h4 { font-family: "KDBGothic", "NotoSansKR", sans-serif; font-size: 11.5pt; color: #13284d; border-bottom: 1px solid #c9d3e2; padding-bottom: 1mm; margin: 6mm 0 3mm; page-break-after: avoid; break-after: avoid; }
h5 { font-size: 10.5pt; font-weight: 700; color: #1f3a6e; margin: 5mm 0 2mm; page-break-after: avoid; break-after: avoid; }
h6 { font-size: 10pt; font-weight: 700; margin: 4mm 0 2mm; }
p { margin: 0 0 2.5mm; }
strong { font-weight: 700; }
/* 목록 항목·문단 첫 토큰의 굵은 키워드(요건 N. / (배경) / (개요 도식))는 남색으로 띄운다 */
li > strong:first-child, p > strong:first-child { color: #0b2f6b; }
td:first-child > strong, td:first-child strong { color: #0b2f6b; }
pre { background: #f6f8fb; border: 1px solid #d5dde9; border-radius: 3px; padding: 2.5mm 3mm; font-size: 8.6pt; line-height: 1.45; overflow: hidden; }
pre code { background: none; padding: 0; font-size: inherit; }
.flow { display: grid; grid-template-columns: max-content 1fr; column-gap: 4mm; row-gap: 0.6mm; align-items: baseline; background: #f4f7fc; border: 1px solid #0b2f6b; border-left-width: 4px; color: #13284d; font-size: 9.5pt; line-height: 1.5; padding: 3.5mm 5mm; margin: 2mm 0 4mm; page-break-inside: avoid; break-inside: avoid; }
.flow > span { white-space: pre; }
.flow-line { grid-column: 1 / -1; color: #33415c; }
.flow-box { font-weight: 700; color: #0b2f6b; }
.flow-branch { font-weight: 500; }
.flow-items { white-space: normal !important; }

ul, ol { margin: 0 0 3mm; padding-left: 5mm; }
ul { list-style: none; }
ul > li { position: relative; padding-left: 4mm; margin-bottom: 1mm; }
ul > li::before { content: "○"; position: absolute; left: 0; color: #0b2f6b; font-size: 0.8em; top: 0.15em; }
ul ul > li::before { content: "-"; color: #33415c; font-size: 1em; top: 0; }
ul ul ul > li::before { content: "·"; color: #33415c; }
ul ul { margin: 1mm 0 1.5mm; }
li > p { margin: 0; }

table { border-collapse: collapse; width: 100%; margin: 2.5mm 0 4mm; font-size: 8.6pt; line-height: 1.45; page-break-inside: auto; }
thead { display: table-header-group; }
/* "(요건 목록)" 같은 표 안내 항목이 표와 다른 쪽으로 갈라지지 않게 한다 */
ul:has(+ table), p:has(+ table) { page-break-after: avoid; break-after: avoid; }
tr { page-break-inside: avoid; break-inside: avoid; }
th, td { border: 1px solid #b9c5d8; padding: 1.4mm 2mm; vertical-align: top; text-align: left; }
th { background: #eaf0f8; color: #23324d; font-weight: 700; text-align: center; white-space: nowrap; }
td:first-child { white-space: nowrap; }
td:nth-child(2) { min-width: 28mm; }
td code { font-size: 0.86em; }
blockquote { border-left: 3px solid #7aa3d8; color: #526078; margin: 3mm 0; padding: 1mm 0 1mm 4mm; }
hr { border: 0; border-top: 1px solid #c9d3e2; margin: 6mm 0; }
img { max-width: 100%; height: auto; display: block; margin: 3mm auto; }
`;
}

function headerTemplate(brand, title) {
  return `<div style="box-sizing:border-box;display:flex;justify-content:space-between;align-items:center;font-family:'Malgun Gothic',sans-serif;font-size:8px;color:#4c5a72;margin:0;padding:6mm 16mm 0;width:100%"><img src="${brand.headerLeft}" style="display:block;height:13px;width:73px"><span>${escapeHtml(title)}</span></div>`;
}

function footerTemplate(brand, left) {
  return `<div style="box-sizing:border-box;display:flex;justify-content:space-between;align-items:flex-end;font-family:'Malgun Gothic',sans-serif;font-size:8px;color:#718096;margin:0;padding:0 16mm 7mm;width:100%"><span style="flex:0 0 auto">${escapeHtml(left)}</span><span style="flex:1 1 auto;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></span><img src="${brand.footerRight}" style="display:block;flex:0 0 auto;height:13px;width:73px"></div>`;
}

async function composeHtml({ parts, subtitle, marked, workspaceRoot }) {
  const fontFaces = (
    await Promise.all(
      FONTS.map(async (font) => {
        try {
          const uri = await toDataUri(workspaceRoot, font.file, "font/woff2");
          return `@font-face { font-family: "${font.family}"; font-weight: ${font.weight}; src: url("${uri}") format("woff2"); }`;
        } catch {
          console.warn(`글꼴을 찾지 못해 시스템 글꼴로 대체합니다: ${font.file}`);
          return "";
        }
      }),
    )
  ).join("\n");

  const authorName = findValue(parts.author, "작성자명");
  const authorDate = findValue(parts.author, "작성일자");
  const bodyHtml = marked.parse(parts.body);
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(parts.title)}</title><style>${styles(fontFaces)}</style></head>
<body>
<header class="title-band">
  <div>
    <div class="org">${escapeHtml(ORGANIZATION)}</div>
    <h1>${escapeHtml(parts.title)}</h1>
    ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
  </div>
  <div class="meta">작성일자 <b>${escapeHtml(authorDate)}</b><br>작성자 <b>${escapeHtml(authorName)}</b></div>
</header>
${infoBox(parts, marked)}
<main>${bodyHtml}</main>
</body></html>`;
}

/** pdfjs-dist로 생성된 PDF를 다시 읽어 쪽수와 첫 쪽 텍스트를 확인한다. 실패해도 생성은 취소하지 않는다. */
async function inspectPdf(pdfPath, expectedTitle) {
  try {
    const pdfjs = await importFromSearchRoots("pdfjs-dist", path.join("legacy", "build", "pdf.mjs"));
    const data = new Uint8Array(await readFile(pdfPath));
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
    const texts = [];
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n);
      texts.push((await page.getTextContent()).items.map((item) => item.str).join(" "));
    }
    // 스크린샷으로 점검할 쪽을 고를 수 있도록 표가 많은 시나리오 절의 쪽 범위를 찾는다
    const scenarioStart = texts.findIndex((t) => /TEST\s*ID/.test(t)) + 1;
    const scenarioEnd = texts.map((t) => /\bTC-\d+/.test(t)).lastIndexOf(true) + 1;
    return {
      pages: doc.numPages,
      titleFound: texts[0].includes(expectedTitle),
      scenarioPages: scenarioStart > 0 ? [scenarioStart, Math.max(scenarioStart, scenarioEnd)] : null,
    };
  } catch (error) {
    return { pages: null, titleFound: null, error: error.message };
  }
}

/**
 * pdf.js를 브라우저 안에서 실행해 PDF 각 쪽을 PNG로 저장한다(pdftoppm 대체).
 * 로컬 파일은 page.route로만 제공하므로 외부 네트워크에 접근하지 않는다.
 */
async function renderPageScreenshots({ chromium, pdfPath, directory, pages }) {
  let pdfjsRoot = null;
  for (const root of moduleSearchRoots()) {
    const candidate = path.join(root, "pdfjs-dist", "legacy", "build", "pdf.mjs");
    try {
      await access(candidate);
      pdfjsRoot = path.dirname(candidate);
      break;
    } catch {
      // 다음 탐색 경로를 확인한다.
    }
  }
  if (!pdfjsRoot) throw new Error(missingModuleMessage("pdfjs-dist"));

  const served = new Map([
    ["/pdf.mjs", { file: path.join(pdfjsRoot, "pdf.mjs"), type: "text/javascript" }],
    ["/pdf.worker.mjs", { file: path.join(pdfjsRoot, "pdf.worker.mjs"), type: "text/javascript" }],
    ["/doc.pdf", { file: pdfPath, type: "application/pdf" }],
  ]);
  const viewer = `<!doctype html><html><body style="margin:0;background:#fff"><canvas id="c"></canvas>
<script type="module">
import * as pdfjs from "/pdf.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
const doc = await pdfjs.getDocument({ url: "/doc.pdf" }).promise;
window.__pages = doc.numPages;
window.__render = async (pageNo) => {
  const page = await doc.getPage(pageNo);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.getElementById("c");
  canvas.width = viewport.width; canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return true;
};
window.__ready = true;
</script></body></html>`;

  await mkdir(directory, { recursive: true });
  const browser = await launchChromium(chromium);
  const written = [];
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") pageErrors.push(message.text()); });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/viewer.html") return route.fulfill({ body: viewer, contentType: "text/html" });
      const entry = served.get(url.pathname);
      if (!entry) return route.abort();
      return route.fulfill({ body: await readFile(entry.file), contentType: entry.type });
    });
    await page.goto("http://design-doc.local/viewer.html");
    try {
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
    } catch (error) {
      throw new Error(`pdf.js 뷰어 초기화 실패: ${pageErrors.join(" | ") || error.message}`);
    }
    const total = await page.evaluate(() => window.__pages);
    const targets = (pages ?? Array.from({ length: total }, (_, i) => i + 1)).filter((n) => n >= 1 && n <= total);
    for (const pageNo of targets) {
      await page.evaluate((n) => window.__render(n), pageNo);
      const file = path.join(directory, `page-${String(pageNo).padStart(2, "0")}.png`);
      await page.locator("#c").screenshot({ path: file });
      written.push(file);
    }
  } finally {
    await browser.close();
  }
  return written;
}

/** `1-3,7` 형식을 쪽 번호 배열로 바꾼다. */
function parsePageRange(text) {
  if (!text) return null;
  const pages = new Set();
  for (const part of text.split(",")) {
    const [start, end] = part.split("-").map((n) => Number(n.trim()));
    if (!Number.isInteger(start)) throw new Error(`쪽 범위 형식 오류: ${text}`);
    for (let n = start; n <= (Number.isInteger(end) ? end : start); n += 1) pages.add(n);
  }
  return [...pages].sort((a, b) => a - b);
}

function parseArgs(argv) {
  const options = { strict: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-strict") { options.strict = false; continue; }
    if (arg === "--check-deps") { options.checkDeps = true; continue; }
    if (arg === "--screenshots-only") { options.screenshotsOnly = true; continue; }
    if (!arg.startsWith("--")) throw new Error(`알 수 없는 인자: ${arg}`);
    const key = arg.slice(2);
    if (!["input", "output", "subtitle", "workspace", "html", "screenshots", "pages"].includes(key)) {
      throw new Error(`알 수 없는 옵션: ${arg}`);
    }
    options[key] = argv[i + 1];
    i += 1;
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const workspaceRoot = path.resolve(options.workspace ?? REPOSITORY_ROOT);
  const marked = (await importFromSearchRoots("marked", path.join("lib", "marked.esm.js"))).marked;
  marked.use({
    gfm: true,
    renderer: {
      // ```flow 블록은 개요 도식(eli5 텍스트 그림)이므로 코드가 아닌 도식 상자로 그린다
      code(first, infostring) {
        // marked 12는 (code, infostring) 위치 인자, 13+는 {text, lang} 토큰을 넘긴다
        const text = typeof first === "string" ? first : first.text;
        const lang = typeof first === "string" ? (infostring ?? "").trim() : first.lang;
        if (lang === "flow") return renderFlow(text);
        return `<pre><code>${escapeHtml(text)}</code></pre>`;
      },
    },
  });

  if (options.checkDeps) {
    const { chromium } = await loadPlaywright();
    const browser = await launchChromium(chromium);
    await browser.close();
    console.log("의존성 확인 완료: marked, playwright, Chromium 실행 가능");
    return;
  }
  if (!options.input) throw new Error("--input <분석/설계서 .md 경로>가 필요합니다.");

  const inputPath = path.resolve(workspaceRoot, options.input);
  const defaultOutput = path.join("output", "pdf", `${path.basename(inputPath, path.extname(inputPath))}.pdf`);
  if (options.screenshotsOnly) {
    if (!options.screenshots) throw new Error("--screenshots-only에는 --screenshots <디렉터리>가 필요합니다.");
    const existing = path.resolve(workspaceRoot, options.output ?? defaultOutput);
    await access(existing);
    const { chromium } = await loadPlaywright();
    const files = await renderPageScreenshots({ chromium, pdfPath: existing, directory: path.resolve(workspaceRoot, options.screenshots), pages: parsePageRange(options.pages) });
    console.log(`쪽 이미지 ${files.length}장: ${path.relative(workspaceRoot, path.dirname(files[0] ?? existing)).replaceAll("\\", "/")}`);
    return;
  }
  const markdown = await readFile(inputPath, "utf8");
  const parts = splitDocument(markdown);
  const problems = validateDocument(markdown, parts);
  if (problems.length) {
    const message = ["양식 검증 실패:", ...problems.map((p) => `  - ${p}`)].join("\n");
    if (options.strict) throw new Error(`${message}\nMarkdown을 고친 뒤 다시 실행하거나 --no-strict로 경고만 남기고 진행하세요.`);
    console.warn(message);
  }

  const brand = {
    headerLeft: await toDataUri(workspaceRoot, BRAND.headerLeft, "image/png"),
    footerRight: await toDataUri(workspaceRoot, BRAND.footerRight, "image/png"),
  };
  const subtitle = options.subtitle ?? deriveSubtitle(markdown);
  const html = await composeHtml({ parts, subtitle, marked, workspaceRoot });

  const outputPath = path.resolve(
    workspaceRoot,
    options.output ?? defaultOutput,
  );
  await mkdir(path.dirname(outputPath), { recursive: true });
  if (options.html) {
    const htmlPath = path.resolve(workspaceRoot, options.html);
    await mkdir(path.dirname(htmlPath), { recursive: true });
    await writeFile(htmlPath, html, "utf8");
  }

  const { chromium } = await loadPlaywright();
  const browser = await launchChromium(chromium);
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const authorDate = findValue(parts.author, "작성일자");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: headerTemplate(brand, `${ORGANIZATION} ${parts.title}`),
      footerTemplate: footerTemplate(brand, authorDate ? `작성일자 ${authorDate}` : ""),
      margin: { top: "20mm", right: "16mm", bottom: "20mm", left: "16mm" },
    });
    await writeFile(outputPath, pdf);
  } finally {
    await browser.close();
  }

  const report = await inspectPdf(outputPath, parts.title);
  console.log(`PDF 생성: ${path.relative(workspaceRoot, outputPath).replaceAll("\\", "/")}`);
  console.log(`입력: ${path.relative(workspaceRoot, inputPath).replaceAll("\\", "/")} (요청자 ${parts.requester.length}항목, 작성자 ${parts.author.length}항목)`);
  if (report.pages !== null) {
    const scenario = report.scenarioPages ? `, 테스트 시나리오 표 ${report.scenarioPages[0]}~${report.scenarioPages[1]}쪽` : "";
    console.log(`검증: ${report.pages}쪽, 제목 "${parts.title}" ${report.titleFound ? "확인" : "미확인"}${scenario}`);
  } else {
    console.warn(`검증 생략: pdfjs-dist 읽기 실패 (${report.error}). --screenshots로 쪽 이미지를 만들어 확인하세요.`);
  }

  if (options.screenshots) {
    const files = await renderPageScreenshots({
      chromium,
      pdfPath: outputPath,
      directory: path.resolve(workspaceRoot, options.screenshots),
      pages: parsePageRange(options.pages),
    });
    console.log(`쪽 이미지 ${files.length}장: ${path.relative(workspaceRoot, path.dirname(files[0] ?? outputPath)).replaceAll("\\", "/")}`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
