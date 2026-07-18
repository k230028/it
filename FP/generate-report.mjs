#!/usr/bin/env node
/**
 * FP 산정 리포트 생성기 (진입점).
 *
 * 사용법:
 *   node FP/generate-report.mjs                    # 오늘 날짜로 생성
 *   node FP/generate-report.mjs --date=2026-07-17  # 특정 날짜로 생성
 *
 * 출력: FP/reports/fp-estimate-report-YYYY-MM-DD.html
 *
 * 입력: FP/fp-estimate-YYYY-MM-DD.csv (Step 5-1 산정 명세, 날짜별)
 *
 * 산정 명세 CSV와 코드베이스 실측을 입력으로 받아 매번 동일한 형태의
 * 리포트를 생성합니다. 복잡도·FP점수는 CSV 값을 신뢰하지 않고 FP.md 매트릭스로
 * 재계산하므로 같은 입력이면 항상 같은 결과가 나옵니다.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readEstimateCsv } from './lib/csv.mjs';
import { scanCodebase } from './lib/scan.mjs';
import { aggregate } from './lib/aggregate.mjs';
import { diffEstimates } from './lib/diff.mjs';
import { renderReport } from './lib/render.mjs';

const FP_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = dirname(FP_DIR);

/** 입출력 경로 (FP/ 기준 상대 위치) */
const PATHS = {
  reportsDir: join(FP_DIR, 'reports'),
  backendSrc: join(PROJECT_ROOT, 'it_backend', 'src', 'main', 'java'),
  // 물리 테이블 수의 SoT. 없으면 scan.mjs가 엔티티 매핑 기준으로 폴백합니다.
  ddlPath: join(PROJECT_ROOT, 'it_database', 'ITPOWN_DDL_live.sql'),
  pagesDir: join(PROJECT_ROOT, 'it_frontend', 'app', 'pages'),
  componentsDir: join(PROJECT_ROOT, 'it_frontend', 'app', 'components'),
  composablesDir: join(PROJECT_ROOT, 'it_frontend', 'app', 'composables'),
};

/**
 * 보정계수·단가 설정 (전부 대표 가정값).
 *
 * ⚠️ 실제 제안·예산 산정 시 해당 연도 고시 「소프트웨어사업 대가산정 가이드」의
 *    보정계수표와 FP당 단가로 반드시 교체하십시오. 이 블록만 고치면 리포트 전체
 *    (보정 후 FP·개발원가·이윤·부가세)가 함께 갱신됩니다.
 */
const CONFIG = {
  factors: [
    { label: '규모 보정계수', value: 0.94, basis: '1,000 FP 이상 대규모 구간 (규모↑ → 단위생산성↑ → 계수↓)' },
    { label: '애플리케이션 유형 보정', value: 1.0, basis: '업무용 웹/DB 표준 애플리케이션' },
    { label: '언어 보정계수', value: 1.0, basis: 'Java / JavaScript 표준' },
    { label: '품질·특성 보정계수', value: 1.06, basis: '보안(JWT·RBAC·감사로그)·신뢰성 요건 반영' },
    { label: '다중 사이트 보정', value: 1.0, basis: '단일 운영 사이트' },
  ],
  unitPrice: 600_000, // 원/FP (보정 전 개발원가 단가)
  profitRate: 0.2, // 이윤 20%
  vatRate: 0.1, // 부가세 10%
};

/** YYYY-MM-DD 형식 검증용 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 해당 날짜의 산정 명세 CSV 경로를 반환합니다(산정본과 리포트를 같은 날짜로 짝지음). */
function csvPathFor(date) {
  return join(FP_DIR, `fp-estimate-${date}.csv`);
}

/** 로컬 시간 기준 오늘 날짜를 YYYY-MM-DD로 반환합니다(UTC 변환으로 하루 밀리는 것 방지). */
function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * --date=YYYY-MM-DD 인자를 파싱합니다. 인자가 없으면 오늘 날짜.
 * @throws {Error} 형식이 YYYY-MM-DD가 아니거나 달력에 없는 날짜인 경우
 */
function resolveDate(argv) {
  const arg = argv.find((a) => a.startsWith('--date='));
  if (!arg) return today();

  const value = arg.slice('--date='.length);
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`--date 형식이 올바르지 않습니다: "${value}" (YYYY-MM-DD 형식이어야 합니다)`);
  }
  // 2026-02-31 처럼 형식만 맞고 실재하지 않는 날짜를 걸러냅니다.
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(value)) {
    throw new Error(`존재하지 않는 날짜입니다: "${value}"`);
  }
  return value;
}

/** 직전 산정본 대비 변경 요약을 콘솔에 출력합니다. */
function printDiff(diff) {
  if (!diff.baseline) {
    console.log('  변경      : 최초 산정 (비교할 직전 산정본 없음)');
    return;
  }
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
  console.log(
    `  변경      : ${diff.baseline} 대비 추가 ${diff.added.length} · 삭제 ${diff.removed.length} · ` +
      `수정 ${diff.changed.length} · 변동없음 ${diff.unchanged} ` +
      `(UFP ${diff.ufpBefore}→${diff.ufpAfter}, ${sign(diff.ufpDelta)})`,
  );
  if (diff.undocumented.length > 0) {
    console.warn(`\n⚠️ 수치가 바뀌었으나 변경내용이 비어 있는 행 ${diff.undocumented.length}건:`);
    for (const k of diff.undocumented) console.warn(`   - ${k}`);
  }
  if (diff.staleNotes.length > 0) {
    console.warn(`\n⚠️ 변동이 없는데 변경내용이 기재된 행 ${diff.staleNotes.length}건 (묵은 메모 확인):`);
    for (const k of diff.staleNotes) console.warn(`   - ${k}`);
  }
}

/** 산정 결과 요약을 콘솔에 출력합니다(리포트를 열지 않고 수치 확인용). */
function printSummary(outPath, agg, scale, rowCount) {
  const { byType, dataTotal, txTotal, ufp } = agg;
  console.log(`생성 완료: ${outPath}`);
  console.log(`  UFP       : ${ufp} FP (데이터 ${dataTotal.fp} + 트랜잭션 ${txTotal.fp})`);
  console.log(
    `  기능 수   : ${rowCount}건 ` +
      `(ILF ${byType.ILF.count} · EIF ${byType.EIF.count} · EI ${byType.EI.count} · EO ${byType.EO.count} · EQ ${byType.EQ.count})`,
  );
  const { tables } = scale;
  console.log(
    `  물리 규모 : 테이블 ${tables.total}(${tables.source === 'ddl' ? 'DDL 실측' : '엔티티 기준'}) · ` +
      `화면 ${scale.pages.total} · 컨트롤러 ${scale.controllers} · 엔드포인트 ${scale.endpoints}`,
  );
  if (tables.orphans.length > 0) {
    console.warn(
      `\n⚠️ 엔티티 없는 테이블 ${tables.orphans.length}건 (물리 ${tables.total} vs 엔티티 매핑 ${tables.entityMapped}):`,
    );
    for (const t of tables.orphans) console.warn(`   - ${t}`);
  }
  if (tables.unmapped.length > 0) {
    console.warn(`\n⚠️ DDL 덤프에 없는 엔티티 매핑 ${tables.unmapped.length}건 (덤프가 낡았을 수 있음):`);
    for (const t of tables.unmapped) console.warn(`   - ${t}`);
  }

  if (agg.mismatches.length > 0) {
    console.warn(`\n⚠️ CSV와 매트릭스 재계산 불일치 ${agg.mismatches.length}건 (리포트는 재계산 값 기준):`);
    for (const m of agg.mismatches) console.warn(`   - ${m}`);
  }
}

function main() {
  const date = resolveDate(process.argv.slice(2));

  const csvPath = csvPathFor(date);
  if (!existsSync(csvPath)) {
    throw new Error(
      `${date} 산정 명세가 없습니다: ${csvPath}\n` +
        `  FP.md Step 5-1에 따라 해당 날짜의 산정 CSV를 먼저 작성하십시오.`,
    );
  }

  const csvRows = readEstimateCsv(csvPath);
  const agg = aggregate(csvRows);
  const scale = scanCodebase(PATHS);
  const diff = diffEstimates(csvRows, FP_DIR, date);

  const html = renderReport({
    date,
    scale,
    agg,
    config: CONFIG,
    csvName: basename(csvPath),
    rowCount: csvRows.length,
    diff,
  });

  mkdirSync(PATHS.reportsDir, { recursive: true });
  const outPath = join(PATHS.reportsDir, `fp-estimate-report-${date}.html`);
  writeFileSync(outPath, html, 'utf8');

  printSummary(outPath, agg, scale, csvRows.length);
  printDiff(diff);
}

try {
  main();
} catch (err) {
  console.error(`리포트 생성 실패: ${err.message}`);
  process.exit(1);
}
