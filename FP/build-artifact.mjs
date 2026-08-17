#!/usr/bin/env node
/**
 * 보고용 기능점수 아티팩트 생성기 (진입점).
 *
 * 사용법:
 *   node FP/build-artifact.mjs                    # 가장 최신 산정본 기준
 *   node FP/build-artifact.mjs --date=2026-08-09  # 특정 산정본 기준
 *
 * 출력: FP/artifact/fp-artifact-YYYY-MM-DD.html
 *
 * generate-report.mjs가 만드는 리포트는 산정이 정확한지 검증하는 실무 문서입니다.
 * 이 생성기는 같은 데이터로 경영진·발주처가 결론부터 읽는 보고 문서를 만듭니다.
 * 산정 로직은 새로 만들지 않고 lib/의 파서·집계기·실측기를 그대로 재사용합니다.
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG, computeCost } from './lib/config.mjs';
import { readEstimateCsv } from './lib/csv.mjs';
import { scanCodebase } from './lib/scan.mjs';
import { aggregate } from './lib/aggregate.mjs';
import { diffEstimates } from './lib/diff.mjs';
import { renderArtifact } from './lib/artifact-render.mjs';

const FP_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = dirname(FP_DIR);

/** 실측 대상 경로 (generate-report.mjs와 동일 기준). */
const PATHS = {
  backendSrc: join(PROJECT_ROOT, 'it_backend', 'src', 'main', 'java'),
  ddlPath: join(PROJECT_ROOT, 'it_database', 'ITPOWN_DDL_live.sql'),
  pagesDir: join(PROJECT_ROOT, 'it_frontend', 'app', 'pages'),
  componentsDir: join(PROJECT_ROOT, 'it_frontend', 'app', 'components'),
  composablesDir: join(PROJECT_ROOT, 'it_frontend', 'app', 'composables'),
};

const CSV_PATTERN = /^fp-estimate-(\d{4}-\d{2}-\d{2})\.csv$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** FP/ 안의 산정본 날짜를 오름차순으로 반환합니다. */
function estimateDates() {
  return readdirSync(FP_DIR)
    .map((f) => f.match(CSV_PATTERN))
    .filter(Boolean)
    .map((m) => m[1])
    .sort();
}

/**
 * --date=YYYY-MM-DD 인자를 파싱합니다. 인자가 없으면 가장 최신 산정본 날짜.
 * @throws {Error} 형식이 어긋나거나 산정본이 하나도 없는 경우
 */
function resolveDate(argv, dates) {
  const arg = argv.find((a) => a.startsWith('--date='));
  if (!arg) {
    if (dates.length === 0) throw new Error(`산정본 CSV가 없습니다: ${FP_DIR}/fp-estimate-*.csv`);
    return dates[dates.length - 1];
  }
  const value = arg.slice('--date='.length);
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`--date 형식이 올바르지 않습니다: "${value}" (YYYY-MM-DD 형식이어야 합니다)`);
  }
  return value;
}

/** 로컬 시간 기준 오늘 날짜(YYYY-MM-DD). */
function today() {
  const now = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 지정 날짜까지의 모든 산정본을 읽어 회차별 UFP 추이를 만듭니다. */
function buildTrend(dates, upto) {
  return dates
    .filter((d) => d <= upto)
    .map((d) => {
      const rows = readEstimateCsv(join(FP_DIR, `fp-estimate-${d}.csv`));
      return { date: d, rows: rows.length, ufp: aggregate(rows).ufp };
    });
}

/** 산정 행을 도메인 단위로 집계해 FP 내림차순으로 반환합니다. */
function tallyByDomain(rows) {
  const map = new Map();
  for (const row of rows) {
    const slot = map.get(row.domain) ?? { domain: row.domain, count: 0, fp: 0 };
    slot.count += 1;
    slot.fp += row.fp;
    map.set(row.domain, slot);
  }
  return [...map.values()].sort((a, b) => b.fp - a.fp);
}

function main() {
  const dates = estimateDates();
  const date = resolveDate(process.argv.slice(2), dates);

  const csvPath = join(FP_DIR, `fp-estimate-${date}.csv`);
  if (!existsSync(csvPath)) {
    throw new Error(
      `${date} 산정 명세가 없습니다: ${csvPath}\n` +
        `  사용 가능한 산정본: ${dates.join(', ') || '(없음)'}`,
    );
  }

  const csvRows = readEstimateCsv(csvPath);
  const agg = aggregate(csvRows);
  const scale = scanCodebase(PATHS);
  const diff = diffEstimates(csvRows, FP_DIR, date);
  const trend = buildTrend(dates, date);
  const cost = computeCost(agg.ufp, CONFIG);

  const html = renderArtifact({
    date,
    generatedAt: today(),
    csvName: basename(csvPath),
    rowCount: csvRows.length,
    agg,
    byDomain: tallyByDomain(agg.rows),
    scale,
    diff,
    trend,
    cost,
    config: CONFIG,
  });

  const outDir = join(FP_DIR, 'artifact');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `fp-artifact-${date}.html`);
  writeFileSync(outPath, html, 'utf8');

  console.log(`생성 완료: ${outPath}`);
  console.log(`  기준 산정본 : ${basename(csvPath)} (${csvRows.length}건)`);
  console.log(`  UFP         : ${agg.ufp} FP`);
  console.log(
    `  보정 후     : ${cost.adjustedFp.toFixed(2)} FP (×${cost.factor.toFixed(4)}) · ` +
      `최종 ${Math.round(cost.total).toLocaleString('ko-KR')}원`,
  );
  console.log(`  추이        : ${trend.map((t) => `${t.date} ${t.ufp}`).join(' → ')}`);

  if (agg.mismatches.length > 0) {
    console.warn(`\n⚠️ CSV와 매트릭스 재계산 불일치 ${agg.mismatches.length}건:`);
    for (const m of agg.mismatches) console.warn(`   - ${m}`);
  }
  if (scale.tables.unmapped.length > 0) {
    console.warn(
      `\n⚠️ DDL 덤프에 없는 엔티티 매핑 ${scale.tables.unmapped.length}건 (아티팩트에 주의사항으로 표기됨):`,
    );
    for (const t of scale.tables.unmapped) console.warn(`   - ${t}`);
  }
}

try {
  main();
} catch (err) {
  console.error(`아티팩트 생성 실패: ${err.message}`);
  process.exit(1);
}
