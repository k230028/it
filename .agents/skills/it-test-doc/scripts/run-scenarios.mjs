// 분석/설계서의 테스트 시나리오 표를 읽어 자동화 테스트(Vitest·JUnit·E2E)를 실행하고
// 시나리오별 PASS/FAIL과 증적 로그를 남긴다. 사용자 시나리오는 실행하지 않고 미실시로 기록한다.
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..", "..", "..", "..");
const FRONTEND = path.join(REPOSITORY_ROOT, "it_frontend");
const BACKEND = path.join(REPOSITORY_ROOT, "it_backend");

const KIND_BY_LABEL = new Map([
  ["vitest", "vitest"],
  ["jacoco", "junit"],
  ["junit", "junit"],
  ["e2e", "e2e"],
  ["playwright", "e2e"],
  ["사용자", "manual"],
]);

/** 시나리오 표 행 `| **TC-01** | 이름 | 구분 | 점검 포인트 | 예상결과 |`를 객체로 바꾼다. */
export function parseScenarios(markdown) {
  const rows = [];
  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    if (!/^\|\s*\**TC-\d+/.test(line)) continue;
    const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
    if (cells.length < 5) continue;
    const id = cells[0].replaceAll("*", "");
    const kindLabel = cells[2].replaceAll("*", "");
    const kind = KIND_BY_LABEL.get(kindLabel.toLowerCase()) ?? "unknown";
    const refs = [...cells[3].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    rows.push({
      id,
      name: cells[1],
      kindLabel,
      kind,
      checkpoint: cells[3],
      expected: cells[4],
      vitestFiles: kind === "vitest" ? refs.filter((r) => /\.test\.ts$/.test(r)) : [],
      e2eFiles: kind === "e2e" ? refs.filter((r) => /\.spec\.ts$/.test(r)) : [],
      // `test('제목')` 참조가 있으면 spec 파일 전체가 아니라 그 test의 결과로 판정한다
      e2eTitles: kind === "e2e" ? refs.map((r) => r.match(/^test\((['"])(.+)\1\)$/)?.[2]).filter(Boolean) : [],
      junitClasses: kind === "junit" ? refs.map((r) => r.match(/([A-Za-z0-9_]+(?:Test|IT|It))\.java$/)?.[1]).filter(Boolean) : [],
    });
  }
  return rows;
}

/** `pdf/PdfViewerToolbar.test.ts`처럼 줄인 경로를 tests/ 아래 실제 파일로 맞춘다. */
async function resolveFrontendTest(ref, cache) {
  const direct = path.join(FRONTEND, ref);
  if (existsSync(direct)) return ref.replaceAll("\\", "/");
  if (!cache.all) {
    cache.all = [];
    const walk = async (dir) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (/\.(test|spec)\.ts$/.test(entry.name)) cache.all.push(path.relative(FRONTEND, full).replaceAll("\\", "/"));
      }
    };
    await walk(path.join(FRONTEND, "tests"));
  }
  const suffix = ref.replace(/^\.{3}\/?/, "").replaceAll("\\", "/");
  const hits = cache.all.filter((p) => p.endsWith("/" + suffix) || p === suffix || path.basename(p) === path.basename(suffix));
  return hits.length === 1 ? hits[0] : null;
}

function run(command, args, cwd, logPath, envOverride = {}) {
  const started = Date.now();
  // shell:true에 명령 한 줄을 넘겨 Node의 인자 재인용(따옴표 이스케이프)을 피한다
  const result = spawnSync(["chcp 65001 >nul &&", command, ...args].join(" "), {
    shell: true,
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: "1", FORCE_COLOR: "0", ...envOverride },
  });
  const output = `$ ${command} ${args.join(" ")}\n(cwd: ${cwd})\n\n${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { status: result.status, output, seconds: ((Date.now() - started) / 1000).toFixed(1), logPath };
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Vitest JSON 리포터 결과를 파일별 집계로 바꾼다. 실패 메시지는 로그의 `FAIL 파일 > 이름` 다음 줄에서 읽는다. */
async function parseVitestJson(jsonPath, logText) {
  const byFile = new Map();
  if (!existsSync(jsonPath)) return byFile;
  const json = JSON.parse(await readFile(jsonPath, "utf8"));
  for (const suite of json.testResults ?? []) {
    const rel = path.relative(FRONTEND, suite.name).replaceAll("\\", "/");
    const cases = suite.assertionResults ?? [];
    const failures = cases.filter((c) => c.status === "failed").map((c) => {
      const fromLog = logText.match(new RegExp(`FAIL\\s+${escapeRegExp(rel)} > ${escapeRegExp(c.fullName)}\\s*\\n(.+)`));
      return `${c.fullName}: ${fromLog?.[1]?.trim() ?? (c.failureMessages ?? [""])[0].split("\n")[0]}`;
    });
    byFile.set(rel, {
      status: suite.status,
      total: cases.length,
      passed: cases.filter((c) => c.status === "passed").length,
      failed: cases.filter((c) => c.status === "failed").length,
      failures,
      seconds: suite.endTime && suite.startTime ? ((suite.endTime - suite.startTime) / 1000).toFixed(1) : null,
    });
  }
  return byFile;
}

async function runVitest(files, evidenceDir) {
  if (files.length === 0) return { files: new Map(), log: null };
  const jsonPath = path.join(evidenceDir, "vitest-results.json");
  const logPath = path.join(evidenceDir, "vitest.log");
  await rm(jsonPath, { force: true });
  const r = run("npx", ["vitest", "run", "--reporter=default", "--reporter=json", `--outputFile=${jsonPath}`, ...files], FRONTEND, logPath);
  await writeFile(logPath, r.output, "utf8");
  const byFile = await parseVitestJson(jsonPath, r.output);

  // 콜드 스타트 timeout 같은 환경 요인을 가르기 위해 실패 파일만 한 번 재실행한다. 1차 결과는 증적에 남긴다.
  const failedFiles = [...byFile.entries()].filter(([, v]) => v.failed > 0).map(([k]) => k);
  let rerunLog = null;
  if (failedFiles.length) {
    const rerunJson = path.join(evidenceDir, "vitest-rerun-results.json");
    const rerunLogPath = path.join(evidenceDir, "vitest-rerun.log");
    const r2 = run("npx", ["vitest", "run", "--reporter=default", "--reporter=json", `--outputFile=${rerunJson}`, ...failedFiles], FRONTEND, rerunLogPath);
    await writeFile(rerunLogPath, r2.output, "utf8");
    rerunLog = path.basename(rerunLogPath);
    const second = await parseVitestJson(rerunJson, r2.output);
    for (const file of failedFiles) {
      const first = byFile.get(file);
      const again = second.get(file);
      if (!again) continue;
      byFile.set(file, { ...again, retried: true, firstAttempt: `1차 ${first.passed}/${first.total} passed, ${first.failed} failed (${first.failures.join("; ")})` });
    }
  }
  return { files: byFile, log: path.basename(logPath), rerunLog, exit: r.status, seconds: r.seconds };
}

async function runJunit(classes, evidenceDir) {
  if (classes.length === 0) return { classes: new Map(), log: null };
  const logPath = path.join(evidenceDir, "gradle-test.log");
  const filters = classes.flatMap((c) => ["--tests", `*${c}`]);
  const startedAt = Date.now();
  // cleanTest로 UP-TO-DATE 스킵을 막아 매번 새 결과 XML이 생기게 한다
  const r = run(`"${path.join(BACKEND, "gradlew.bat")}"`, ["cleanTest", "test", ...filters, "--console=plain"], BACKEND, logPath);
  await writeFile(logPath, r.output, "utf8");
  const byClass = new Map();
  const resultsDir = path.join(BACKEND, "build", "test-results", "test");
  if (existsSync(resultsDir)) {
    for (const file of await readdir(resultsDir)) {
      const simple = file.replace(/^TEST-/, "").replace(/\.xml$/, "").split(".").pop();
      if (!classes.includes(simple)) continue;
      // 이번 실행 전에 만들어진 결과 파일은 증적이 아니다(빌드 실패 시 옛 결과를 PASS로 오인하지 않게)
      const { mtimeMs } = await stat(path.join(resultsDir, file));
      if (mtimeMs < startedAt) continue;
      const xml = await readFile(path.join(resultsDir, file), "utf8");
      const attr = (name) => Number(xml.match(new RegExp(`<testsuite[^>]*\\s${name}="([^"]+)"`))?.[1] ?? 0);
      const failures = [...xml.matchAll(/<testcase[^>]*name="([^"]+)"[^>]*>\s*<(failure|error)[^>]*message="([^"]*)"/g)].map((m) => `${m[1]}: ${m[3].slice(0, 160)}`);
      byClass.set(simple, {
        total: attr("tests"),
        failed: attr("failures") + attr("errors"),
        skipped: attr("skipped"),
        passed: attr("tests") - attr("failures") - attr("errors") - attr("skipped"),
        seconds: xml.match(/<testsuite[^>]*\stime="([^"]+)"/)?.[1] ?? null,
        failures,
        xml: file,
      });
      await copyFile(path.join(resultsDir, file), path.join(evidenceDir, file));
    }
  }
  return { classes: byClass, log: path.basename(logPath), exit: r.status, seconds: r.seconds };
}

/**
 * Playwright JSON 리포터 결과를 spec 파일별 집계로 바꾼다.
 * 테스트 상태는 expected(통과)·flaky(재시도 통과)·unexpected(실패)·skipped 넷이며,
 * flaky는 통과로 세되 1차 실패 사실을 `retried`로 남긴다(콜드 컴파일 timeout 구분용).
 */
export function parsePlaywrightJson(json) {
  const byFile = new Map();
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      const file = `tests/e2e/${spec.file.replaceAll("\\", "/")}`;
      const entry = byFile.get(file) ?? { status: "passed", total: 0, passed: 0, failed: 0, skipped: 0, retried: 0, failures: [], titles: new Map() };
      for (const t of spec.tests ?? []) {
        entry.total += 1;
        if (t.status === "expected") entry.passed += 1;
        else if (t.status === "flaky") { entry.passed += 1; entry.retried += 1; }
        else if (t.status === "skipped") entry.skipped += 1;
        else {
          entry.failed += 1;
          entry.status = "failed";
          const message = t.results?.map((r) => r.error?.message).find(Boolean) ?? "";
          entry.failures.push(`${spec.title}: ${message.split("\n")[0].trim()}`);
        }
        // 같은 제목이 프로젝트별로 여러 번 나오면 하나라도 실패하면 실패로 본다
        const prev = entry.titles.get(spec.title);
        const status = t.status === "unexpected" ? "failed" : t.status === "skipped" ? "skipped" : "passed";
        entry.titles.set(spec.title, prev === "failed" ? "failed" : status);
      }
      byFile.set(file, entry);
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of json.suites ?? []) visit(suite);
  return byFile;
}

/**
 * 프론트 playwright.config를 그대로 쓰되 스크린샷을 항상 남기고(`screenshot: 'on'`) 산출물을 증적 디렉터리로 보내는
 * 래퍼 설정을 만든다. testDir·webServer.cwd는 설정 파일 위치 기준으로 해석되므로 절대 경로로 고정한다.
 */
async function writePlaywrightWrapperConfig(evidenceDir) {
  const e2eDir = path.join(evidenceDir, "e2e");
  await mkdir(e2eDir, { recursive: true });
  const configPath = path.join(e2eDir, "playwright.evidence.config.ts");
  const posix = (p) => p.replaceAll("\\", "/");
  await writeFile(
    configPath,
    `// it-test-doc 실행기가 생성한 래퍼 설정. 원본은 it_frontend/playwright.config.ts이며 스크린샷만 항상 켠다.
import path from 'node:path';
import base from '${posix(path.join(FRONTEND, "playwright.config"))}';

export default {
    ...base,
    testDir: '${posix(path.join(FRONTEND, "tests", "e2e"))}',
    // 원본의 상대 경로 globalSetup(dev 서버 워밍업)은 이 파일 위치 기준으로 풀리므로 절대 경로로 다시 준다
    globalSetup: '${posix(path.join(FRONTEND, "tests", "e2e", "global-setup.ts"))}',
    outputDir: '${posix(path.join(e2eDir, "artifacts"))}',
    reporter: [['list'], ['json', { outputFile: '${posix(path.join(e2eDir, "playwright-results.json"))}' }]],
    use: { ...base.use, screenshot: 'on', trace: 'off', video: 'off' },
    webServer: { ...base.webServer, cwd: '${posix(FRONTEND)}' },
};
`,
    "utf8",
  );
  return { configPath, e2eDir };
}

/** ANSI 색상 코드를 지운다(Playwright 오류 메시지용). */
const stripAnsi = (text) => text.replace(/\[[0-9;]*m/g, "");

/**
 * Playwright 결과에서 spec별 스크린샷을 `e2e/screenshots/`로 복사한다.
 * 파일명은 `{spec}-{순번}-{상태}.png`로 읽기 쉽게 바꾸고, 결과서가 참조할 상대 경로 목록을 돌려준다.
 */
async function collectScreenshots(json, e2eDir, evidenceDir) {
  const shotsDir = path.join(e2eDir, "screenshots");
  await mkdir(shotsDir, { recursive: true });
  const byFile = new Map();
  const visit = async (suite) => {
    for (const spec of suite.specs ?? []) {
      const file = `tests/e2e/${spec.file.replaceAll("\\", "/")}`;
      const specBase = path.basename(spec.file, ".spec.ts");
      const list = byFile.get(file) ?? [];
      for (const t of spec.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        const shots = (last?.attachments ?? []).filter((a) => a.name === "screenshot" && a.path && existsSync(a.path));
        for (const shot of shots) {
          const status = t.status === "unexpected" ? "fail" : "pass";
          const target = path.join(shotsDir, `${specBase}-${String(list.length + 1).padStart(2, "0")}-${status}.png`);
          await copyFile(shot.path, target);
          list.push({ title: spec.title, status, file: path.relative(evidenceDir, target).replaceAll("\\", "/") });
        }
      }
      byFile.set(file, list);
    }
    for (const child of suite.suites ?? []) await visit(child);
  };
  for (const suite of json.suites ?? []) await visit(suite);
  return byFile;
}

async function runE2e(files, evidenceDir) {
  if (files.length === 0) return { files: new Map(), log: null };
  const { configPath, e2eDir } = await writePlaywrightWrapperConfig(evidenceDir);
  const jsonPath = path.join(e2eDir, "playwright-results.json");
  const logPath = path.join(e2eDir, "playwright.log");
  await rm(jsonPath, { force: true });
  // CI를 비워야 playwright.config의 reuseExistingServer가 켜져 이미 떠 있는 nuxt dev(3002)를 재사용하고,
  // 첫 진입 화면의 지연 컴파일 timeout을 retries=1로 걸러낸다. 서버가 없으면 webServer가 직접 기동한다.
  const r = run("npx", ["playwright", "test", `--config "${configPath}"`, ...files], FRONTEND, logPath, { CI: "" });
  await writeFile(logPath, stripAnsi(r.output), "utf8");
  let byFile = new Map();
  let screenshots = new Map();
  if (existsSync(jsonPath)) {
    const json = JSON.parse(await readFile(jsonPath, "utf8"));
    byFile = parsePlaywrightJson(json);
    for (const entry of byFile.values()) entry.failures = entry.failures.map(stripAnsi);
    screenshots = await collectScreenshots(json, e2eDir, evidenceDir);
    // 원본 artifacts 폴더(중복 PNG·error-context)는 지우고 이름을 바꾼 스크린샷만 증적으로 남긴다
    await rm(path.join(e2eDir, "artifacts"), { recursive: true, force: true });
  }
  const relJson = path.relative(evidenceDir, jsonPath).replaceAll("\\", "/");
  return { files: byFile, screenshots, log: path.relative(evidenceDir, logPath).replaceAll("\\", "/"), json: relJson, exit: r.status, seconds: r.seconds };
}

function parseArgs(argv) {
  // E2E는 API mock·webServer 자동 기동으로 자급자족하므로 기본 실행이다. --include-e2e는 옛 호출 호환용.
  const options = { includeE2e: true, skipBackend: false, skipFrontend: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--include-e2e") { options.includeE2e = true; continue; }
    if (arg === "--skip-e2e") { options.includeE2e = false; continue; }
    if (arg === "--skip-backend") { options.skipBackend = true; continue; }
    if (arg === "--skip-frontend") { options.skipFrontend = true; continue; }
    if (!arg.startsWith("--")) throw new Error(`알 수 없는 인자: ${arg}`);
    const key = arg.slice(2);
    if (!["design", "evidence", "out"].includes(key)) throw new Error(`알 수 없는 옵션: ${arg}`);
    options[key] = argv[i + 1];
    i += 1;
  }
  if (!options.design) throw new Error("--design <분석/설계서 .md>가 필요합니다.");
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const designPath = path.resolve(REPOSITORY_ROOT, options.design);
  const today = new Date().toISOString().slice(0, 10);
  const evidenceDir = path.resolve(REPOSITORY_ROOT, options.evidence ?? path.join("docs", "test-docs", "evidence", today));
  const outPath = path.resolve(REPOSITORY_ROOT, options.out ?? path.join("tmp", "test-doc", "results.json"));
  await mkdir(evidenceDir, { recursive: true });
  await mkdir(path.dirname(outPath), { recursive: true });

  const scenarios = parseScenarios(await readFile(designPath, "utf8"));
  if (scenarios.length === 0) throw new Error("테스트 시나리오 행(`| **TC-nn** |`)을 찾지 못했습니다.");

  const cache = {};
  const vitestSet = new Set();
  const e2eSet = new Set();
  const junitSet = new Set();
  for (const s of scenarios) {
    s.resolvedVitest = [];
    for (const ref of s.vitestFiles) {
      const resolved = await resolveFrontendTest(ref, cache);
      if (resolved) { s.resolvedVitest.push(resolved); vitestSet.add(resolved); } else s.unresolved = [...(s.unresolved ?? []), ref];
    }
    s.resolvedE2e = [];
    for (const ref of s.e2eFiles) {
      const resolved = await resolveFrontendTest(ref, cache);
      if (resolved) { s.resolvedE2e.push(resolved); e2eSet.add(resolved); } else s.unresolved = [...(s.unresolved ?? []), ref];
    }
    for (const c of s.junitClasses) junitSet.add(c);
  }

  const startedAt = new Date();
  const vitest = options.skipFrontend ? { files: new Map(), log: null } : await runVitest([...vitestSet], evidenceDir);
  const junit = options.skipBackend ? { classes: new Map(), log: null } : await runJunit([...junitSet], evidenceDir);
  const e2e = options.includeE2e ? await runE2e([...e2eSet], evidenceDir) : { files: new Map(), log: null };

  const rel = (p) => path.relative(REPOSITORY_ROOT, p).replaceAll("\\", "/");
  for (const s of scenarios) {
    const parts = [];
    let failed = 0;
    let covered = 0;
    if (s.kind === "vitest" && options.skipFrontend) { s.status = "미실시"; s.evidence = "프론트 미실행(--skip-frontend)"; continue; }
    if (s.kind === "junit" && options.skipBackend) { s.status = "미실시"; s.evidence = "백엔드 미실행(--skip-backend)"; continue; }
    if (s.kind === "vitest") {
      for (const f of s.resolvedVitest) {
        const r = vitest.files.get(f);
        if (!r) { parts.push(`${f}: 실행 결과 없음`); continue; }
        covered += 1; failed += r.failed;
        parts.push(`${f} → ${r.passed}/${r.total} passed${r.failed ? `, ${r.failed} failed` : ""}${r.retried ? ` (재실행; ${r.firstAttempt})` : ""}`);
        if (r.failures.length) s.failures = [...(s.failures ?? []), ...r.failures];
        if (r.retried) s.rerunLog = vitest.rerunLog;
      }
      s.evidenceLog = vitest.log;
    } else if (s.kind === "junit") {
      for (const c of s.junitClasses) {
        const r = junit.classes.get(c);
        if (!r) { parts.push(`${c}: 실행 결과 없음`); continue; }
        covered += 1; failed += r.failed;
        parts.push(`${c} → ${r.passed}/${r.total} passed${r.failed ? `, ${r.failed} failed` : ""}${r.skipped ? `, ${r.skipped} skipped` : ""} · \`${r.xml}\``);
        if (r.failures.length) s.failures = [...(s.failures ?? []), ...r.failures];
      }
      s.evidenceLog = junit.log;
    } else if (s.kind === "e2e") {
      if (!options.includeE2e) { s.status = "미실시"; s.evidence = "E2E 미실행(--skip-e2e 지정)"; continue; }
      if (s.resolvedE2e.length === 0 && /\(신설\)/.test(s.checkpoint)) {
        s.status = "미확인";
        s.evidence = `E2E spec 미작성(신설 예정: ${s.e2eFiles.join(", ") || "경로 없음"}) · it-test-maintenance로 작성 후 재실행`;
        continue;
      }
      for (const f of s.resolvedE2e) {
        const r = e2e.files.get(f);
        if (!r) { parts.push(`${f}: 실행 결과 없음`); continue; }
        const shots = e2e.screenshots?.get(f) ?? [];
        if (s.e2eTitles.length) {
          // 제목 지정 행은 그 test만 판정한다. 제목이 spec에 없으면 아직 작성되지 않은 것이므로 미확인으로 남긴다
          const missing = s.e2eTitles.filter((t) => !r.titles.has(t));
          if (missing.length) parts.push(`${f}: test 미작성 — ${missing.map((t) => `'${t}'`).join(", ")}`);
          const found = s.e2eTitles.filter((t) => r.titles.has(t));
          if (found.length === 0) continue;
          const failedTitles = found.filter((t) => r.titles.get(t) === "failed");
          covered += 1; failed += failedTitles.length;
          s.screenshots = [...(s.screenshots ?? []), ...shots.filter((shot) => found.includes(shot.title))];
          parts.push(`${f} → ${found.map((t) => `'${t}' ${r.titles.get(t)}`).join(", ")} · \`${e2e.json}\``);
          if (failedTitles.length) s.failures = [...(s.failures ?? []), ...r.failures.filter((m) => failedTitles.some((t) => m.startsWith(`${t}:`)))];
          continue;
        }
        covered += 1; failed += r.failed;
        s.screenshots = [...(s.screenshots ?? []), ...shots];
        parts.push(`${f} → ${r.passed}/${r.total} passed${r.failed ? `, ${r.failed} failed` : ""}${r.skipped ? `, ${r.skipped} skipped` : ""}${r.retried ? ` (재시도 통과 ${r.retried})` : ""} · \`${e2e.json}\`${shots.length ? ` · 스크린샷 ${shots.length}장` : ""}`);
        if (r.failures.length) s.failures = [...(s.failures ?? []), ...r.failures];
      }
      s.evidenceLog = e2e.log;
    } else if (s.kind === "manual") {
      s.status = "미실시";
      s.evidence = "사용자 확인 필요";
      continue;
    } else {
      s.status = "미확인";
      s.evidence = `구분 '${s.kindLabel}' 해석 불가`;
      continue;
    }
    if (s.unresolved?.length) parts.push(`미해결 참조: ${s.unresolved.join(", ")}`);
    s.status = covered === 0 ? "미확인" : failed > 0 ? "FAIL" : "PASS";
    s.evidence = parts.join(" · ") + (s.evidenceLog ? ` · 로그 ${s.evidenceLog}` : "") + (s.rerunLog ? `, ${s.rerunLog}` : "");
  }

  const summary = {
    designDocument: rel(designPath),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    evidenceDir: rel(evidenceDir),
    commands: {
      vitest: vitestSet.size ? `npx vitest run ${[...vitestSet].join(" ")}` : null,
      junit: junitSet.size ? `./gradlew cleanTest test ${[...junitSet].map((c) => `--tests '*${c}'`).join(" ")}` : null,
      e2e: options.includeE2e && e2eSet.size ? `npx playwright test ${[...e2eSet].join(" ")}` : null,
    },
    exit: { vitest: vitest.exit ?? null, junit: junit.exit ?? null, e2e: e2e.exit ?? null },
    counts: {
      total: scenarios.length,
      PASS: scenarios.filter((s) => s.status === "PASS").length,
      FAIL: scenarios.filter((s) => s.status === "FAIL").length,
      미실시: scenarios.filter((s) => s.status === "미실시").length,
      미확인: scenarios.filter((s) => s.status === "미확인").length,
    },
    scenarios,
  };
  await writeFile(outPath, JSON.stringify(summary, null, 2), "utf8");

  // 결과서 표 초안: 에이전트가 그대로 옮겨 적을 수 있게 7열로 낸다
  const draft = [
    "| TEST ID | 시나리오명 | 구분 | 점검 포인트 | 예상결과 | 실제결과 | 증적 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...scenarios.map((s) => `| **${s.id}** | ${s.name} | ${s.kindLabel} | ${s.checkpoint} · ${s.expected} | PASS | ${s.status} | ${s.evidence} |`),
  ].join("\n");
  const draftPath = path.join(path.dirname(outPath), "table-draft.md");
  await writeFile(draftPath, draft, "utf8");

  const c = summary.counts;
  console.log(`시나리오 ${c.total}건: PASS ${c.PASS} · FAIL ${c.FAIL} · 미실시 ${c.미실시} · 미확인 ${c.미확인}`);
  if (vitest.exit !== undefined) console.log(`Vitest 종료코드 ${vitest.exit} (${vitest.seconds}s) · 파일 ${vitest.files.size}`);
  if (junit.exit !== undefined) console.log(`JUnit 종료코드 ${junit.exit} (${junit.seconds}s) · 클래스 ${junit.classes.size}`);
  if (e2e.exit !== undefined) console.log(`E2E 종료코드 ${e2e.exit} (${e2e.seconds}s)`);
  console.log(`결과: ${rel(outPath)} · 표 초안: ${rel(draftPath)} · 증적: ${rel(evidenceDir)}`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
